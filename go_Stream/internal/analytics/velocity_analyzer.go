package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// VelocityDataPoint represents a real velocity calculation point
type VelocityDataPoint struct {
	Price      float64   `json:"price"`
	Timestamp  time.Time `json:"timestamp"`
	Volume     float64   `json:"volume"`
	Velocity   float64   `json:"velocity"`     // Price change per second
	Acceleration float64 `json:"acceleration"` // Velocity change per second
}

// VelocityWindow represents velocity analysis for a specific time window
type VelocityWindow struct {
	WindowSize    time.Duration `json:"window_size"`
	DataPoints    []VelocityDataPoint `json:"data_points"`
	AvgVelocity   float64       `json:"avg_velocity"`
	MaxVelocity   float64       `json:"max_velocity"`
	MinVelocity   float64       `json:"min_velocity"`
	Acceleration  float64       `json:"acceleration"`
	VelocityTrend string        `json:"velocity_trend"` // "ACCELERATING", "DECELERATING", "STABLE"
	LastUpdate    time.Time     `json:"last_update"`
}

// VelocitySignal represents velocity-based trading signals
type VelocitySignal struct {
	Symbol            string           `json:"symbol"`
	CurrentVelocity   float64          `json:"current_velocity"`
	VelocityPercentile float64         `json:"velocity_percentile"` // 0.0-1.0
	AccelerationScore float64          `json:"acceleration_score"`
	MomentumBurst     bool             `json:"momentum_burst"`
	VelocityRegime    string           `json:"velocity_regime"`    // "LOW", "NORMAL", "HIGH", "EXTREME"
	Signal            string           `json:"signal"`             // "BUY", "SELL", "NEUTRAL", "MOMENTUM_ENTRY"
	Confidence        float64          `json:"confidence"`         // 0.0-1.0
	Windows           map[string]VelocityWindow `json:"windows"`
	BurstProbability  float64          `json:"burst_probability"`  // Probability of momentum burst
	Reasoning         string           `json:"reasoning"`
	Timestamp         time.Time        `json:"timestamp"`
}

// VelocityAnalyzer processes real price data to calculate velocity and acceleration
type VelocityAnalyzer struct {
	redisClient    *redis.Client
	symbol         string
	
	// Multi-timeframe velocity tracking
	windows        map[string]*VelocityWindow
	windowSizes    []time.Duration
	maxDataPoints  int
	
	// Velocity calculation parameters
	minDataPoints     int
	velocityThreshold float64   // Minimum velocity for significance
	burstThreshold    float64   // Velocity threshold for momentum burst
	accelerationThreshold float64 // Acceleration threshold
	
	// Historical velocity data for percentile calculation
	historicalVelocities []float64
	maxHistoricalData    int
	
	// Real-time data storage
	recentTrades      []VelocityDataPoint
	maxRecentTrades   int
	
	mu                sync.RWMutex
	lastAnalysis      time.Time
	analysisInterval  time.Duration
}

// NewVelocityAnalyzer creates a new real velocity analyzer
func NewVelocityAnalyzer(redisClient *redis.Client, symbol string) *VelocityAnalyzer {
	windowSizes := []time.Duration{
		10 * time.Second,
		30 * time.Second,
		1 * time.Minute,
		2 * time.Minute,
		5 * time.Minute,
	}
	
	va := &VelocityAnalyzer{
		redisClient:           redisClient,
		symbol:                symbol,
		windowSizes:           windowSizes,
		maxDataPoints:         200,
		minDataPoints:         5,
		velocityThreshold:     0.001, // 0.1% per second
		burstThreshold:        0.01,  // 1% per second
		accelerationThreshold: 0.005, // 0.5% per second²
		maxHistoricalData:     1000,
		maxRecentTrades:       500,
		analysisInterval:      2 * time.Second,
		windows:               make(map[string]*VelocityWindow),
		historicalVelocities:  make([]float64, 0, 1000),
		recentTrades:          make([]VelocityDataPoint, 0, 500),
	}
	
	// Initialize velocity windows
	for _, windowSize := range windowSizes {
		windowKey := fmt.Sprintf("%v", windowSize)
		va.windows[windowKey] = &VelocityWindow{
			WindowSize:    windowSize,
			DataPoints:    make([]VelocityDataPoint, 0, va.maxDataPoints),
			VelocityTrend: "STABLE",
		}
	}
	
	return va
}

// ProcessTrade processes real trade data for velocity analysis
func (va *VelocityAnalyzer) ProcessTrade(tradeData []byte) error {
	va.mu.Lock()
	defer va.mu.Unlock()
	
	// Parse real trade data
	var trade struct {
		Symbol    string    `json:"symbol"`
		Price     float64   `json:"price"`
		Volume    float64   `json:"volume"`
		Timestamp time.Time `json:"timestamp"`
	}
	
	if err := json.Unmarshal(tradeData, &trade); err != nil {
		return fmt.Errorf("failed to parse trade data: %w", err)
	}
	
	// Validate real data
	if trade.Symbol != va.symbol || trade.Price <= 0 || trade.Volume <= 0 {
		return fmt.Errorf("invalid trade data: symbol=%s, price=%f, volume=%f", 
			trade.Symbol, trade.Price, trade.Volume)
	}
	
	// Calculate velocity if we have previous data
	velocity := 0.0
	acceleration := 0.0
	
	if len(va.recentTrades) > 0 {
		lastTrade := va.recentTrades[len(va.recentTrades)-1]
		timeDiff := trade.Timestamp.Sub(lastTrade.Timestamp).Seconds()
		
		if timeDiff > 0 {
			// Calculate velocity (price change per second)
			priceChange := (trade.Price - lastTrade.Price) / lastTrade.Price
			velocity = priceChange / timeDiff
			
			// Calculate acceleration if we have velocity history
			if len(va.recentTrades) > 1 {
				prevVelocity := lastTrade.Velocity
				velocityChange := velocity - prevVelocity
				acceleration = velocityChange / timeDiff
			}
		}
	}
	
	// Create velocity data point
	dataPoint := VelocityDataPoint{
		Price:        trade.Price,
		Timestamp:    trade.Timestamp,
		Volume:       trade.Volume,
		Velocity:     velocity,
		Acceleration: acceleration,
	}
	
	// Add to recent trades
	va.recentTrades = append(va.recentTrades, dataPoint)
	
	// Clean old trades
	va.cleanOldTrades()
	
	// Update velocity windows
	va.updateVelocityWindows(dataPoint)
	
	// Add to historical velocities for percentile calculation
	if math.Abs(velocity) > va.velocityThreshold {
		va.historicalVelocities = append(va.historicalVelocities, math.Abs(velocity))
		if len(va.historicalVelocities) > va.maxHistoricalData {
			va.historicalVelocities = va.historicalVelocities[1:]
		}
	}
	
	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(va.lastAnalysis) >= va.analysisInterval {
		signal := va.generateVelocitySignal()
		if signal != nil {
			va.publishVelocitySignal(signal)
		}
		va.lastAnalysis = now
	}
	
	return nil
}

// cleanOldTrades removes trades older than the maximum window
func (va *VelocityAnalyzer) cleanOldTrades() {
	maxWindow := va.windowSizes[len(va.windowSizes)-1] // Largest window
	cutoff := time.Now().Add(-maxWindow * 2) // Keep 2x the largest window
	
	validTrades := make([]VelocityDataPoint, 0, len(va.recentTrades))
	for _, trade := range va.recentTrades {
		if trade.Timestamp.After(cutoff) {
			validTrades = append(validTrades, trade)
		}
	}
	va.recentTrades = validTrades
	
	// Limit memory usage
	if len(va.recentTrades) > va.maxRecentTrades {
		va.recentTrades = va.recentTrades[len(va.recentTrades)-va.maxRecentTrades:]
	}
}

// updateVelocityWindows updates velocity analysis for all time windows
func (va *VelocityAnalyzer) updateVelocityWindows(dataPoint VelocityDataPoint) {
	for _, windowSize := range va.windowSizes {
		windowKey := fmt.Sprintf("%v", windowSize)
		window := va.windows[windowKey]
		
		// Add data point to window
		window.DataPoints = append(window.DataPoints, dataPoint)
		
		// Remove old data points outside the window
		cutoff := dataPoint.Timestamp.Add(-windowSize)
		validPoints := make([]VelocityDataPoint, 0, len(window.DataPoints))
		
		for _, point := range window.DataPoints {
			if point.Timestamp.After(cutoff) {
				validPoints = append(validPoints, point)
			}
		}
		window.DataPoints = validPoints
		
		// Limit data points per window
		if len(window.DataPoints) > va.maxDataPoints {
			window.DataPoints = window.DataPoints[len(window.DataPoints)-va.maxDataPoints:]
		}
		
		// Calculate window statistics
		va.calculateWindowStatistics(window)
	}
}

// calculateWindowStatistics calculates velocity statistics for a window
func (va *VelocityAnalyzer) calculateWindowStatistics(window *VelocityWindow) {
	if len(window.DataPoints) < va.minDataPoints {
		return
	}
	
	velocities := make([]float64, 0, len(window.DataPoints))
	accelerations := make([]float64, 0, len(window.DataPoints))
	
	for _, point := range window.DataPoints {
		velocities = append(velocities, point.Velocity)
		accelerations = append(accelerations, point.Acceleration)
	}
	
	// Calculate average velocity
	velocitySum := 0.0
	for _, v := range velocities {
		velocitySum += v
	}
	window.AvgVelocity = velocitySum / float64(len(velocities))
	
	// Calculate min/max velocity
	window.MinVelocity = velocities[0]
	window.MaxVelocity = velocities[0]
	for _, v := range velocities {
		if v < window.MinVelocity {
			window.MinVelocity = v
		}
		if v > window.MaxVelocity {
			window.MaxVelocity = v
		}
	}
	
	// Calculate average acceleration
	accelerationSum := 0.0
	for _, a := range accelerations {
		accelerationSum += a
	}
	window.Acceleration = accelerationSum / float64(len(accelerations))
	
	// Determine velocity trend
	window.VelocityTrend = va.determineVelocityTrend(window.Acceleration)
	
	window.LastUpdate = time.Now()
}

// determineVelocityTrend determines the velocity trend from acceleration
func (va *VelocityAnalyzer) determineVelocityTrend(acceleration float64) string {
	if acceleration > va.accelerationThreshold {
		return "ACCELERATING"
	} else if acceleration < -va.accelerationThreshold {
		return "DECELERATING"
	} else {
		return "STABLE"
	}
}

// generateVelocitySignal generates comprehensive velocity-based signals
func (va *VelocityAnalyzer) generateVelocitySignal() *VelocitySignal {
	if len(va.recentTrades) < va.minDataPoints {
		return nil
	}
	
	// Get current velocity
	currentVelocity := 0.0
	if len(va.recentTrades) > 0 {
		currentVelocity = va.recentTrades[len(va.recentTrades)-1].Velocity
	}
	
	// Calculate velocity percentile
	velocityPercentile := va.calculateVelocityPercentile(math.Abs(currentVelocity))
	
	// Calculate acceleration score
	accelerationScore := va.calculateAccelerationScore()
	
	// Detect momentum burst
	momentumBurst := va.detectMomentumBurst()
	
	// Determine velocity regime
	velocityRegime := va.determineVelocityRegime(velocityPercentile)
	
	// Generate trading signal
	signal, confidence := va.generateTradingSignal(currentVelocity, velocityPercentile, 
		accelerationScore, momentumBurst, velocityRegime)
	
	// Calculate burst probability
	burstProbability := va.calculateBurstProbability(velocityPercentile, accelerationScore)
	
	// Generate reasoning
	reasoning := va.generateReasoning(currentVelocity, velocityRegime, momentumBurst, signal)
	
	// Create windows map for output
	windowsMap := make(map[string]VelocityWindow)
	for key, window := range va.windows {
		windowsMap[key] = *window
	}
	
	return &VelocitySignal{
		Symbol:            va.symbol,
		CurrentVelocity:   currentVelocity,
		VelocityPercentile: velocityPercentile,
		AccelerationScore: accelerationScore,
		MomentumBurst:     momentumBurst,
		VelocityRegime:    velocityRegime,
		Signal:            signal,
		Confidence:        confidence,
		Windows:           windowsMap,
		BurstProbability:  burstProbability,
		Reasoning:         reasoning,
		Timestamp:         time.Now(),
	}
}

// calculateVelocityPercentile calculates where current velocity ranks historically
func (va *VelocityAnalyzer) calculateVelocityPercentile(currentVelocity float64) float64 {
	if len(va.historicalVelocities) < 10 {
		return 0.5 // Default to 50th percentile
	}
	
	// Sort historical velocities
	sortedVelocities := make([]float64, len(va.historicalVelocities))
	copy(sortedVelocities, va.historicalVelocities)
	sort.Float64s(sortedVelocities)
	
	// Find percentile
	count := 0
	for _, v := range sortedVelocities {
		if v <= currentVelocity {
			count++
		}
	}
	
	return float64(count) / float64(len(sortedVelocities))
}

// calculateAccelerationScore calculates overall acceleration score
func (va *VelocityAnalyzer) calculateAccelerationScore() float64 {
	totalScore := 0.0
	validWindows := 0
	
	for _, window := range va.windows {
		if len(window.DataPoints) >= va.minDataPoints {
			// Normalize acceleration to 0-1 scale
			normalizedAcceleration := math.Min(math.Abs(window.Acceleration)/va.accelerationThreshold, 1.0)
			totalScore += normalizedAcceleration
			validWindows++
		}
	}
	
	if validWindows == 0 {
		return 0.0
	}
	
	return totalScore / float64(validWindows)
}

// detectMomentumBurst detects if a momentum burst is occurring
func (va *VelocityAnalyzer) detectMomentumBurst() bool {
	// Check short-term windows for burst conditions
	shortTermWindows := []string{"10s", "30s", "1m0s"}
	
	burstCount := 0
	for _, windowKey := range shortTermWindows {
		if window, exists := va.windows[windowKey]; exists {
			if len(window.DataPoints) >= va.minDataPoints {
				// Check if velocity exceeds burst threshold
				if math.Abs(window.AvgVelocity) >= va.burstThreshold {
					burstCount++
				}
				// Check if acceleration is significant
				if math.Abs(window.Acceleration) >= va.accelerationThreshold*2 {
					burstCount++
				}
			}
		}
	}
	
	// Burst detected if multiple conditions met
	return burstCount >= 2
}

// determineVelocityRegime classifies current velocity regime
func (va *VelocityAnalyzer) determineVelocityRegime(velocityPercentile float64) string {
	if velocityPercentile >= 0.95 {
		return "EXTREME"
	} else if velocityPercentile >= 0.8 {
		return "HIGH"
	} else if velocityPercentile >= 0.3 {
		return "NORMAL"
	} else {
		return "LOW"
	}
}

// generateTradingSignal generates trading signals based on velocity analysis
func (va *VelocityAnalyzer) generateTradingSignal(currentVelocity, velocityPercentile, 
	accelerationScore float64, momentumBurst bool, velocityRegime string) (string, float64) {
	
	// Base confidence from velocity significance
	confidence := velocityPercentile
	
	// Momentum burst signal
	if momentumBurst {
		if currentVelocity > 0 {
			return "MOMENTUM_ENTRY", math.Min(confidence*1.5, 1.0)
		} else {
			return "MOMENTUM_ENTRY", math.Min(confidence*1.5, 1.0)
		}
	}
	
	// High velocity regime signals
	if velocityRegime == "EXTREME" || velocityRegime == "HIGH" {
		if currentVelocity > va.velocityThreshold {
			return "BUY", confidence
		} else if currentVelocity < -va.velocityThreshold {
			return "SELL", confidence
		}
	}
	
	// Acceleration-based signals
	if accelerationScore > 0.7 {
		if currentVelocity > 0 {
			return "BUY", confidence * accelerationScore
		} else {
			return "SELL", confidence * accelerationScore
		}
	}
	
	// Low velocity - neutral signal
	return "NEUTRAL", confidence * 0.3
}

// calculateBurstProbability calculates probability of momentum burst
func (va *VelocityAnalyzer) calculateBurstProbability(velocityPercentile, accelerationScore float64) float64 {
	// Combine velocity percentile and acceleration for burst probability
	burstProb := (velocityPercentile*0.6 + accelerationScore*0.4)
	
	// Boost probability if already in high velocity regime
	if velocityPercentile > 0.8 {
		burstProb *= 1.3
	}
	
	return math.Min(burstProb, 1.0)
}

// generateReasoning generates human-readable reasoning
func (va *VelocityAnalyzer) generateReasoning(currentVelocity float64, velocityRegime string, 
	momentumBurst bool, signal string) string {
	
	direction := "neutral"
	if currentVelocity > 0 {
		direction = "upward"
	} else if currentVelocity < 0 {
		direction = "downward"
	}
	
	reasoning := fmt.Sprintf("Velocity: %.4f/s (%s regime, %s movement)", 
		currentVelocity, velocityRegime, direction)
	
	if momentumBurst {
		reasoning += ". MOMENTUM BURST detected"
	}
	
	reasoning += fmt.Sprintf(". Signal: %s", signal)
	
	return reasoning
}

// publishVelocitySignal publishes velocity signal to Redis
func (va *VelocityAnalyzer) publishVelocitySignal(signal *VelocitySignal) error {
	data, err := json.Marshal(signal)
	if err != nil {
		return fmt.Errorf("failed to marshal velocity signal: %w", err)
	}
	
	channel := fmt.Sprintf("%s:velocity", va.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = va.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish velocity signal: %w", err)
	}
	
	log.Printf("⚡ Velocity: %s | %s | Vel: %.4f/s | Regime: %s | Burst: %t | Conf: %.3f",
		signal.Symbol, signal.Signal, signal.CurrentVelocity, signal.VelocityRegime, 
		signal.MomentumBurst, signal.Confidence)
	
	return nil
}

// Start begins the real velocity analysis process
func (va *VelocityAnalyzer) Start(ctx context.Context) error {
	log.Printf("⚡ Starting Velocity Analyzer for %s", va.symbol)
	
	// Subscribe to real trade events
	channel := fmt.Sprintf("%s:trade", va.symbol)
	pubsub := va.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := va.ProcessTrade([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Velocity processing error for %s: %v", va.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the velocity analyzer
func (va *VelocityAnalyzer) Stop() error {
	log.Printf("🛑 Stopping Velocity Analyzer for %s", va.symbol)
	return nil
}

// Health returns the health status
func (va *VelocityAnalyzer) Health() bool {
	va.mu.RLock()
	defer va.mu.RUnlock()
	
	// Check if we have recent trades
	if len(va.recentTrades) == 0 {
		return true // No trades is normal
	}
	
	// Check if latest trade is recent (within last 2 minutes)
	latestTrade := va.recentTrades[len(va.recentTrades)-1]
	return time.Since(latestTrade.Timestamp) < 2*time.Minute
}

// Name returns the service name
func (va *VelocityAnalyzer) Name() string {
	return fmt.Sprintf("VelocityAnalyzer-%s", va.symbol)
} 