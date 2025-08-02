package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// DeltaTapeEntry represents a single entry in the delta tape
type DeltaTapeEntry struct {
	Price      float64   `json:"price"`
	Volume     float64   `json:"volume"`
	Delta      float64   `json:"delta"`        // Volume delta (positive = buy, negative = sell)
	CumDelta   float64   `json:"cum_delta"`    // Cumulative delta up to this point
	Side       string    `json:"side"`         // "BUY", "SELL", "NEUTRAL"
	Timestamp  time.Time `json:"timestamp"`
	TradeID    int       `json:"trade_id"`
	IsSweep    bool      `json:"is_sweep"`     // Large aggressive order
	IsBlock    bool      `json:"is_block"`     // Block trade
}

// DeltaTapePattern represents recognized patterns in the delta tape
type DeltaTapePattern struct {
	PatternType    string    `json:"pattern_type"`    // "ACCUMULATION", "DISTRIBUTION", "ABSORPTION", "BREAKOUT"
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	Duration       time.Duration `json:"duration"`
	StartPrice     float64   `json:"start_price"`
	EndPrice       float64   `json:"end_price"`
	PriceChange    float64   `json:"price_change"`
	TotalVolume    float64   `json:"total_volume"`
	NetDelta       float64   `json:"net_delta"`
	Strength       float64   `json:"strength"`        // Pattern strength 0.0-1.0
	Confidence     float64   `json:"confidence"`      // Pattern confidence 0.0-1.0
	ExpectedMove   float64   `json:"expected_move"`   // Expected price movement
	TimeFrame      string    `json:"time_frame"`      // "SHORT", "MEDIUM", "LONG"
}

// DeltaFlowMetrics represents comprehensive delta flow analysis
type DeltaFlowMetrics struct {
	Symbol                string              `json:"symbol"`
	CurrentDelta          float64             `json:"current_delta"`
	CumulativeDelta       float64             `json:"cumulative_delta"`
	DeltaVelocity         float64             `json:"delta_velocity"`      // Rate of delta change
	DeltaAcceleration     float64             `json:"delta_acceleration"`  // Change in velocity
	FlowMomentum          string              `json:"flow_momentum"`       // "STRONG_BUY", "BUY", "NEUTRAL", "SELL", "STRONG_SELL"
	DominantSide          string              `json:"dominant_side"`       // Current dominant side
	FlowIntensity         float64             `json:"flow_intensity"`      // Intensity of current flow
	VolumeProfile         map[float64]float64 `json:"volume_profile"`      // Price -> Volume mapping
	DeltaProfile          map[float64]float64 `json:"delta_profile"`       // Price -> Delta mapping
	ActivePatterns        []DeltaTapePattern  `json:"active_patterns"`
	FlowDivergence        bool                `json:"flow_divergence"`     // Price vs delta divergence
	AbsorptionLevel       float64             `json:"absorption_level"`    // Market absorption capacity
	LiquidityFlow         string              `json:"liquidity_flow"`      // "PROVIDING", "TAKING", "BALANCED"
	Timestamp             time.Time           `json:"timestamp"`
}

// DeltaTapeAlert represents delta tape based alerts
type DeltaTapeAlert struct {
	Symbol            string             `json:"symbol"`
	AlertType         string             `json:"alert_type"`         // "PATTERN_DETECTED", "FLOW_SHIFT", "DIVERGENCE"
	DetectedPattern   *DeltaTapePattern  `json:"detected_pattern"`
	FlowSignal        string             `json:"flow_signal"`        // "BUY", "SELL", "NEUTRAL"
	Urgency           string             `json:"urgency"`            // "LOW", "MEDIUM", "HIGH", "CRITICAL"
	ExpectedImpact    string             `json:"expected_impact"`    // "MINIMAL", "MODERATE", "SIGNIFICANT", "MAJOR"
	RecommendedAction string             `json:"recommended_action"` // "FOLLOW", "FADE", "WAIT", "AVOID"
	RiskLevel         string             `json:"risk_level"`         // "LOW", "MEDIUM", "HIGH"
	Confidence        float64            `json:"confidence"`         // Alert confidence
	Timestamp         time.Time          `json:"timestamp"`
}

// DeltaTapeAnalyzer analyzes real order flow delta patterns
type DeltaTapeAnalyzer struct {
	redisClient    *redis.Client
	symbol         string
	
	// Delta tape data
	deltaTape      []DeltaTapeEntry
	maxTapeSize    int
	tradeCounter   int
	
	// Delta calculation parameters
	volumeThreshold    float64   // Minimum volume for significance
	sweepThreshold     float64   // Volume threshold for sweep detection
	blockThreshold     float64   // Volume threshold for block detection
	
	// Pattern recognition parameters
	patternWindow      time.Duration // Window for pattern detection
	minPatternDuration time.Duration // Minimum pattern duration
	maxPatternDuration time.Duration // Maximum pattern duration
	
	// Flow analysis parameters
	velocityWindow     time.Duration // Window for velocity calculation
	accelerationWindow time.Duration // Window for acceleration calculation
	
	// Active patterns
	activePatterns     []DeltaTapePattern
	maxActivePatterns  int
	
	// Volume and delta profiles
	volumeProfile      map[float64]float64
	deltaProfile       map[float64]float64
	profileResolution  float64 // Price resolution for profiles
	
	// Flow metrics
	recentDeltas       []float64
	maxRecentDeltas    int
	cumulativeDelta    float64
	lastDeltaVelocity  float64
	
	mu                 sync.RWMutex
	lastAnalysis       time.Time
	analysisInterval   time.Duration
}

// NewDeltaTapeAnalyzer creates a new real delta tape analyzer
func NewDeltaTapeAnalyzer(redisClient *redis.Client, symbol string) *DeltaTapeAnalyzer {
	return &DeltaTapeAnalyzer{
		redisClient:        redisClient,
		symbol:             symbol,
		maxTapeSize:        5000,  // Keep 5000 tape entries
		volumeThreshold:    100.0, // Minimum significant volume
		sweepThreshold:     1000.0, // Volume for sweep detection
		blockThreshold:     5000.0, // Volume for block detection
		patternWindow:      10 * time.Minute,
		minPatternDuration: 30 * time.Second,
		maxPatternDuration: 5 * time.Minute,
		velocityWindow:     1 * time.Minute,
		accelerationWindow: 30 * time.Second,
		maxActivePatterns:  10,
		profileResolution:  0.01, // 1 cent resolution
		maxRecentDeltas:    100,
		analysisInterval:   3 * time.Second,
		deltaTape:          make([]DeltaTapeEntry, 0, 5000),
		activePatterns:     make([]DeltaTapePattern, 0, 10),
		volumeProfile:      make(map[float64]float64),
		deltaProfile:       make(map[float64]float64),
		recentDeltas:       make([]float64, 0, 100),
	}
}

// ProcessTrade processes real trade data for delta tape analysis
func (dta *DeltaTapeAnalyzer) ProcessTrade(tradeData []byte) error {
	dta.mu.Lock()
	defer dta.mu.Unlock()
	
	// Parse real trade data
	var trade struct {
		Symbol    string    `json:"symbol"`
		Price     float64   `json:"price"`
		Volume    float64   `json:"volume"`
		Side      string    `json:"side"`
		Timestamp time.Time `json:"timestamp"`
	}
	
	if err := json.Unmarshal(tradeData, &trade); err != nil {
		return fmt.Errorf("failed to parse trade data: %w", err)
	}
	
	// Validate real data
	if trade.Symbol != dta.symbol || trade.Price <= 0 || trade.Volume <= 0 {
		return fmt.Errorf("invalid trade data: symbol=%s, price=%f, volume=%f", 
			trade.Symbol, trade.Price, trade.Volume)
	}
	
	// Calculate delta based on trade side
	delta := 0.0
	switch trade.Side {
	case "BUY", "buy":
		delta = trade.Volume
	case "SELL", "sell":
		delta = -trade.Volume
	default:
		// For neutral trades, use tick rule or other classification
		delta = dta.classifyTradeDelta(trade.Price, trade.Volume)
	}
	
	// Update cumulative delta
	dta.cumulativeDelta += delta
	
	// Detect special order types
	isSweep := trade.Volume >= dta.sweepThreshold
	isBlock := trade.Volume >= dta.blockThreshold
	
	// Create delta tape entry
	dta.tradeCounter++
	entry := DeltaTapeEntry{
		Price:     trade.Price,
		Volume:    trade.Volume,
		Delta:     delta,
		CumDelta:  dta.cumulativeDelta,
		Side:      trade.Side,
		Timestamp: trade.Timestamp,
		TradeID:   dta.tradeCounter,
		IsSweep:   isSweep,
		IsBlock:   isBlock,
	}
	
	// Add to delta tape
	dta.deltaTape = append(dta.deltaTape, entry)
	
	// Maintain tape size
	if len(dta.deltaTape) > dta.maxTapeSize {
		dta.deltaTape = dta.deltaTape[1:]
	}
	
	// Update profiles
	dta.updateProfiles(entry)
	
	// Update recent deltas for velocity calculation
	dta.recentDeltas = append(dta.recentDeltas, delta)
	if len(dta.recentDeltas) > dta.maxRecentDeltas {
		dta.recentDeltas = dta.recentDeltas[1:]
	}
	
	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(dta.lastAnalysis) >= dta.analysisInterval {
		dta.performAnalysis()
		dta.lastAnalysis = now
	}
	
	return nil
}

// classifyTradeDelta classifies trade delta when side is unknown
func (dta *DeltaTapeAnalyzer) classifyTradeDelta(price, volume float64) float64 {
	if len(dta.deltaTape) == 0 {
		return 0.0 // Neutral if no history
	}
	
	// Simple tick rule: compare with recent price
	recentEntry := dta.deltaTape[len(dta.deltaTape)-1]
	
	if price > recentEntry.Price {
		return volume // Uptick = buy
	} else if price < recentEntry.Price {
		return -volume // Downtick = sell
	} else {
		return 0.0 // No change = neutral
	}
}

// updateProfiles updates volume and delta profiles
func (dta *DeltaTapeAnalyzer) updateProfiles(entry DeltaTapeEntry) {
	// Round price to resolution
	priceLevel := math.Round(entry.Price/dta.profileResolution) * dta.profileResolution
	
	// Update volume profile
	dta.volumeProfile[priceLevel] += entry.Volume
	
	// Update delta profile
	dta.deltaProfile[priceLevel] += entry.Delta
}

// performAnalysis performs comprehensive delta tape analysis
func (dta *DeltaTapeAnalyzer) performAnalysis() {
	// Detect patterns
	newPatterns := dta.detectPatterns()
	dta.updateActivePatterns(newPatterns)
	
	// Calculate flow metrics
	metrics := dta.calculateFlowMetrics()
	if metrics != nil {
		dta.publishFlowMetrics(metrics)
		
		// Generate alerts if necessary
		alert := dta.generateDeltaTapeAlert(metrics)
		if alert != nil {
			dta.publishDeltaTapeAlert(alert)
		}
	}
}

// detectPatterns detects patterns in the delta tape
func (dta *DeltaTapeAnalyzer) detectPatterns() []DeltaTapePattern {
	var patterns []DeltaTapePattern
	
	if len(dta.deltaTape) < 50 {
		return patterns // Need minimum data
	}
	
	// Detect accumulation patterns
	accumPatterns := dta.detectAccumulationPatterns()
	patterns = append(patterns, accumPatterns...)
	
	// Detect distribution patterns
	distPatterns := dta.detectDistributionPatterns()
	patterns = append(patterns, distPatterns...)
	
	// Detect absorption patterns
	absorbPatterns := dta.detectAbsorptionPatterns()
	patterns = append(patterns, absorbPatterns...)
	
	// Detect breakout patterns
	breakoutPatterns := dta.detectBreakoutPatterns()
	patterns = append(patterns, breakoutPatterns...)
	
	return patterns
}

// detectAccumulationPatterns detects accumulation patterns
func (dta *DeltaTapeAnalyzer) detectAccumulationPatterns() []DeltaTapePattern {
	var patterns []DeltaTapePattern
	
	// Look for sustained positive delta with minimal price movement
	cutoff := time.Now().Add(-dta.patternWindow)
	
	var windowEntries []DeltaTapeEntry
	for _, entry := range dta.deltaTape {
		if entry.Timestamp.After(cutoff) {
			windowEntries = append(windowEntries, entry)
		}
	}
	
	if len(windowEntries) < 10 {
		return patterns
	}
	
	// Calculate metrics for accumulation detection
	totalDelta := 0.0
	totalVolume := 0.0
	minPrice := windowEntries[0].Price
	maxPrice := windowEntries[0].Price
	
	for _, entry := range windowEntries {
		totalDelta += entry.Delta
		totalVolume += entry.Volume
		if entry.Price < minPrice {
			minPrice = entry.Price
		}
		if entry.Price > maxPrice {
			maxPrice = entry.Price
		}
	}
	
	priceRange := (maxPrice - minPrice) / minPrice
	deltaRatio := totalDelta / totalVolume
	
	// Accumulation criteria: positive delta, low price movement
	if totalDelta > 0 && deltaRatio > 0.3 && priceRange < 0.02 { // 2% price range
		pattern := DeltaTapePattern{
			PatternType:  "ACCUMULATION",
			StartTime:    windowEntries[0].Timestamp,
			EndTime:      windowEntries[len(windowEntries)-1].Timestamp,
			Duration:     windowEntries[len(windowEntries)-1].Timestamp.Sub(windowEntries[0].Timestamp),
			StartPrice:   windowEntries[0].Price,
			EndPrice:     windowEntries[len(windowEntries)-1].Price,
			PriceChange:  windowEntries[len(windowEntries)-1].Price - windowEntries[0].Price,
			TotalVolume:  totalVolume,
			NetDelta:     totalDelta,
			Strength:     deltaRatio,
			Confidence:   math.Min(deltaRatio*2, 1.0),
			ExpectedMove: totalDelta / totalVolume * 0.1, // Simplified calculation
			TimeFrame:    "MEDIUM",
		}
		patterns = append(patterns, pattern)
	}
	
	return patterns
}

// detectDistributionPatterns detects distribution patterns
func (dta *DeltaTapeAnalyzer) detectDistributionPatterns() []DeltaTapePattern {
	var patterns []DeltaTapePattern
	
	// Look for sustained negative delta with minimal price movement
	cutoff := time.Now().Add(-dta.patternWindow)
	
	var windowEntries []DeltaTapeEntry
	for _, entry := range dta.deltaTape {
		if entry.Timestamp.After(cutoff) {
			windowEntries = append(windowEntries, entry)
		}
	}
	
	if len(windowEntries) < 10 {
		return patterns
	}
	
	// Calculate metrics for distribution detection
	totalDelta := 0.0
	totalVolume := 0.0
	minPrice := windowEntries[0].Price
	maxPrice := windowEntries[0].Price
	
	for _, entry := range windowEntries {
		totalDelta += entry.Delta
		totalVolume += entry.Volume
		if entry.Price < minPrice {
			minPrice = entry.Price
		}
		if entry.Price > maxPrice {
			maxPrice = entry.Price
		}
	}
	
	priceRange := (maxPrice - minPrice) / minPrice
	deltaRatio := totalDelta / totalVolume
	
	// Distribution criteria: negative delta, low price movement
	if totalDelta < 0 && deltaRatio < -0.3 && priceRange < 0.02 { // 2% price range
		pattern := DeltaTapePattern{
			PatternType:  "DISTRIBUTION",
			StartTime:    windowEntries[0].Timestamp,
			EndTime:      windowEntries[len(windowEntries)-1].Timestamp,
			Duration:     windowEntries[len(windowEntries)-1].Timestamp.Sub(windowEntries[0].Timestamp),
			StartPrice:   windowEntries[0].Price,
			EndPrice:     windowEntries[len(windowEntries)-1].Price,
			PriceChange:  windowEntries[len(windowEntries)-1].Price - windowEntries[0].Price,
			TotalVolume:  totalVolume,
			NetDelta:     totalDelta,
			Strength:     math.Abs(deltaRatio),
			Confidence:   math.Min(math.Abs(deltaRatio)*2, 1.0),
			ExpectedMove: totalDelta / totalVolume * 0.1, // Simplified calculation
			TimeFrame:    "MEDIUM",
		}
		patterns = append(patterns, pattern)
	}
	
	return patterns
}

// detectAbsorptionPatterns detects absorption patterns
func (dta *DeltaTapeAnalyzer) detectAbsorptionPatterns() []DeltaTapePattern {
	var patterns []DeltaTapePattern
	
	// Look for high volume with minimal delta (absorption)
	cutoff := time.Now().Add(-dta.velocityWindow) // Shorter window for absorption
	
	var windowEntries []DeltaTapeEntry
	for _, entry := range dta.deltaTape {
		if entry.Timestamp.After(cutoff) {
			windowEntries = append(windowEntries, entry)
		}
	}
	
	if len(windowEntries) < 5 {
		return patterns
	}
	
	totalDelta := 0.0
	totalVolume := 0.0
	
	for _, entry := range windowEntries {
		totalDelta += math.Abs(entry.Delta) // Use absolute delta
		totalVolume += entry.Volume
	}
	
	// Absorption criteria: high volume, low net delta
	absorptionRatio := math.Abs(totalDelta) / totalVolume
	if totalVolume > dta.sweepThreshold && absorptionRatio < 0.2 {
		pattern := DeltaTapePattern{
			PatternType:  "ABSORPTION",
			StartTime:    windowEntries[0].Timestamp,
			EndTime:      windowEntries[len(windowEntries)-1].Timestamp,
			Duration:     windowEntries[len(windowEntries)-1].Timestamp.Sub(windowEntries[0].Timestamp),
			StartPrice:   windowEntries[0].Price,
			EndPrice:     windowEntries[len(windowEntries)-1].Price,
			PriceChange:  windowEntries[len(windowEntries)-1].Price - windowEntries[0].Price,
			TotalVolume:  totalVolume,
			NetDelta:     totalDelta,
			Strength:     1.0 - absorptionRatio, // Higher strength for lower ratio
			Confidence:   math.Min((1.0-absorptionRatio)*2, 1.0),
			ExpectedMove: 0.0, // Absorption typically precedes moves
			TimeFrame:    "SHORT",
		}
		patterns = append(patterns, pattern)
	}
	
	return patterns
}

// detectBreakoutPatterns detects breakout patterns
func (dta *DeltaTapeAnalyzer) detectBreakoutPatterns() []DeltaTapePattern {
	var patterns []DeltaTapePattern
	
	// Look for sudden delta surge with price movement
	cutoff := time.Now().Add(-dta.accelerationWindow) // Short window for breakouts
	
	var windowEntries []DeltaTapeEntry
	for _, entry := range dta.deltaTape {
		if entry.Timestamp.After(cutoff) {
			windowEntries = append(windowEntries, entry)
		}
	}
	
	if len(windowEntries) < 3 {
		return patterns
	}
	
	totalDelta := 0.0
	totalVolume := 0.0
	priceChange := windowEntries[len(windowEntries)-1].Price - windowEntries[0].Price
	
	for _, entry := range windowEntries {
		totalDelta += entry.Delta
		totalVolume += entry.Volume
	}
	
	deltaVelocity := totalDelta / windowEntries[len(windowEntries)-1].Timestamp.Sub(windowEntries[0].Timestamp).Seconds()
	priceVelocity := math.Abs(priceChange) / windowEntries[0].Price
	
	// Breakout criteria: high delta velocity with price movement
	if math.Abs(deltaVelocity) > 100 && priceVelocity > 0.001 { // 0.1% price movement
		direction := "UP"
		if totalDelta < 0 {
			direction = "DOWN"
		}
		
		pattern := DeltaTapePattern{
			PatternType:  fmt.Sprintf("BREAKOUT_%s", direction),
			StartTime:    windowEntries[0].Timestamp,
			EndTime:      windowEntries[len(windowEntries)-1].Timestamp,
			Duration:     windowEntries[len(windowEntries)-1].Timestamp.Sub(windowEntries[0].Timestamp),
			StartPrice:   windowEntries[0].Price,
			EndPrice:     windowEntries[len(windowEntries)-1].Price,
			PriceChange:  priceChange,
			TotalVolume:  totalVolume,
			NetDelta:     totalDelta,
			Strength:     math.Min(math.Abs(deltaVelocity)/200, 1.0),
			Confidence:   math.Min(priceVelocity*1000, 1.0),
			ExpectedMove: priceChange * 2, // Expect continuation
			TimeFrame:    "SHORT",
		}
		patterns = append(patterns, pattern)
	}
	
	return patterns
}

// updateActivePatterns updates the list of active patterns
func (dta *DeltaTapeAnalyzer) updateActivePatterns(newPatterns []DeltaTapePattern) {
	// Add new patterns
	for _, pattern := range newPatterns {
		// Check if pattern already exists (avoid duplicates)
		exists := false
		for _, active := range dta.activePatterns {
			if dta.isSimilarPattern(pattern, active) {
				exists = true
				break
			}
		}
		
		if !exists {
			dta.activePatterns = append(dta.activePatterns, pattern)
		}
	}
	
	// Remove expired patterns
	now := time.Now()
	validPatterns := make([]DeltaTapePattern, 0, len(dta.activePatterns))
	
	for _, pattern := range dta.activePatterns {
		// Keep patterns that are still within max duration
		if now.Sub(pattern.EndTime) < dta.maxPatternDuration {
			validPatterns = append(validPatterns, pattern)
		}
	}
	
	dta.activePatterns = validPatterns
	
	// Limit active patterns
	if len(dta.activePatterns) > dta.maxActivePatterns {
		// Keep the most recent patterns
		dta.activePatterns = dta.activePatterns[len(dta.activePatterns)-dta.maxActivePatterns:]
	}
}

// isSimilarPattern checks if two patterns are similar
func (dta *DeltaTapeAnalyzer) isSimilarPattern(p1, p2 DeltaTapePattern) bool {
	// Check pattern type
	if p1.PatternType != p2.PatternType {
		return false
	}
	
	// Check time overlap
	timeOverlap := !(p1.EndTime.Before(p2.StartTime) || p2.EndTime.Before(p1.StartTime))
	
	// Check price overlap
	priceOverlap := !(p1.EndPrice < p2.StartPrice || p2.EndPrice < p1.StartPrice)
	
	return timeOverlap && priceOverlap
}

// calculateFlowMetrics calculates comprehensive flow metrics
func (dta *DeltaTapeAnalyzer) calculateFlowMetrics() *DeltaFlowMetrics {
	if len(dta.deltaTape) < 10 {
		return nil
	}
	
	// Get current delta
	currentDelta := 0.0
	if len(dta.deltaTape) > 0 {
		currentDelta = dta.deltaTape[len(dta.deltaTape)-1].Delta
	}
	
	// Calculate delta velocity
	deltaVelocity := dta.calculateDeltaVelocity()
	
	// Calculate delta acceleration
	deltaAcceleration := dta.calculateDeltaAcceleration()
	
	// Determine flow momentum
	flowMomentum := dta.determineFlowMomentum(deltaVelocity, deltaAcceleration)
	
	// Determine dominant side
	dominantSide := dta.determineDominantSide()
	
	// Calculate flow intensity
	flowIntensity := dta.calculateFlowIntensity()
	
	// Check for flow divergence
	flowDivergence := dta.detectFlowDivergence()
	
	// Calculate absorption level
	absorptionLevel := dta.calculateAbsorptionLevel()
	
	// Determine liquidity flow
	liquidityFlow := dta.determineLiquidityFlow()
	
	return &DeltaFlowMetrics{
		Symbol:             dta.symbol,
		CurrentDelta:       currentDelta,
		CumulativeDelta:    dta.cumulativeDelta,
		DeltaVelocity:      deltaVelocity,
		DeltaAcceleration:  deltaAcceleration,
		FlowMomentum:       flowMomentum,
		DominantSide:       dominantSide,
		FlowIntensity:      flowIntensity,
		VolumeProfile:      dta.volumeProfile,
		DeltaProfile:       dta.deltaProfile,
		ActivePatterns:     dta.activePatterns,
		FlowDivergence:     flowDivergence,
		AbsorptionLevel:    absorptionLevel,
		LiquidityFlow:      liquidityFlow,
		Timestamp:          time.Now(),
	}
}

// calculateDeltaVelocity calculates the rate of delta change
func (dta *DeltaTapeAnalyzer) calculateDeltaVelocity() float64 {
	if len(dta.recentDeltas) < 2 {
		return 0.0
	}
	
	// Calculate sum of recent deltas
	recentSum := 0.0
	for _, delta := range dta.recentDeltas {
		recentSum += delta
	}
	
	// Velocity as delta per second (simplified)
	return recentSum / dta.velocityWindow.Seconds()
}

// calculateDeltaAcceleration calculates the change in delta velocity
func (dta *DeltaTapeAnalyzer) calculateDeltaAcceleration() float64 {
	currentVelocity := dta.calculateDeltaVelocity()
	acceleration := currentVelocity - dta.lastDeltaVelocity
	dta.lastDeltaVelocity = currentVelocity
	
	return acceleration
}

// determineFlowMomentum determines flow momentum from velocity and acceleration
func (dta *DeltaTapeAnalyzer) determineFlowMomentum(velocity, acceleration float64) string {
	if velocity > 500 && acceleration > 0 {
		return "STRONG_BUY"
	} else if velocity > 100 {
		return "BUY"
	} else if velocity < -500 && acceleration < 0 {
		return "STRONG_SELL"
	} else if velocity < -100 {
		return "SELL"
	} else {
		return "NEUTRAL"
	}
}

// determineDominantSide determines the currently dominant side
func (dta *DeltaTapeAnalyzer) determineDominantSide() string {
	if len(dta.recentDeltas) == 0 {
		return "NEUTRAL"
	}
	
	buyVolume := 0.0
	sellVolume := 0.0
	
	for _, delta := range dta.recentDeltas {
		if delta > 0 {
			buyVolume += delta
		} else {
			sellVolume += math.Abs(delta)
		}
	}
	
	if buyVolume > sellVolume*1.2 {
		return "BUY"
	} else if sellVolume > buyVolume*1.2 {
		return "SELL"
	} else {
		return "BALANCED"
	}
}

// calculateFlowIntensity calculates the intensity of current flow
func (dta *DeltaTapeAnalyzer) calculateFlowIntensity() float64 {
	if len(dta.recentDeltas) == 0 {
		return 0.0
	}
	
	// Calculate variance of recent deltas
	sum := 0.0
	for _, delta := range dta.recentDeltas {
		sum += math.Abs(delta)
	}
	avg := sum / float64(len(dta.recentDeltas))
	
	variance := 0.0
	for _, delta := range dta.recentDeltas {
		diff := math.Abs(delta) - avg
		variance += diff * diff
	}
	variance /= float64(len(dta.recentDeltas))
	
	// Intensity as normalized standard deviation
	intensity := math.Sqrt(variance) / (avg + 1.0) // +1 to avoid division by zero
	return math.Min(intensity, 1.0)
}

// detectFlowDivergence detects divergence between price and delta flow
func (dta *DeltaTapeAnalyzer) detectFlowDivergence() bool {
	if len(dta.deltaTape) < 20 {
		return false
	}
	
	// Get recent entries
	recentEntries := dta.deltaTape[len(dta.deltaTape)-20:]
	
	// Calculate price trend
	priceChange := recentEntries[len(recentEntries)-1].Price - recentEntries[0].Price
	
	// Calculate delta trend
	deltaSum := 0.0
	for _, entry := range recentEntries {
		deltaSum += entry.Delta
	}
	
	// Divergence: price up but delta negative, or price down but delta positive
	return (priceChange > 0 && deltaSum < -1000) || (priceChange < 0 && deltaSum > 1000)
}

// calculateAbsorptionLevel calculates market absorption capacity
func (dta *DeltaTapeAnalyzer) calculateAbsorptionLevel() float64 {
	if len(dta.deltaTape) < 10 {
		return 0.0
	}
	
	// Recent high-volume trades
	recentEntries := dta.deltaTape[len(dta.deltaTape)-10:]
	
	totalVolume := 0.0
	totalDelta := 0.0
	
	for _, entry := range recentEntries {
		totalVolume += entry.Volume
		totalDelta += math.Abs(entry.Delta)
	}
	
	if totalVolume == 0 {
		return 0.0
	}
	
	// Absorption level: how much volume is absorbed vs creates imbalance
	absorptionRatio := 1.0 - (totalDelta / totalVolume)
	return math.Max(0.0, math.Min(absorptionRatio, 1.0))
}

// determineLiquidityFlow determines type of liquidity flow
func (dta *DeltaTapeAnalyzer) determineLiquidityFlow() string {
	if len(dta.deltaTape) < 5 {
		return "BALANCED"
	}
	
	// Count aggressive vs passive trades (simplified)
	recentEntries := dta.deltaTape[len(dta.deltaTape)-5:]
	
	aggressiveCount := 0
	passiveCount := 0
	
	for _, entry := range recentEntries {
		if entry.IsSweep || entry.IsBlock {
			aggressiveCount++
		} else {
			passiveCount++
		}
	}
	
	if aggressiveCount > passiveCount {
		return "TAKING"
	} else if passiveCount > aggressiveCount {
		return "PROVIDING"
	} else {
		return "BALANCED"
	}
}

// generateDeltaTapeAlert generates delta tape based alerts
func (dta *DeltaTapeAnalyzer) generateDeltaTapeAlert(metrics *DeltaFlowMetrics) *DeltaTapeAlert {
	// Only generate alerts for significant conditions
	if len(metrics.ActivePatterns) == 0 && 
		 metrics.FlowMomentum == "NEUTRAL" && 
		 !metrics.FlowDivergence {
		return nil
	}
	
	var alert *DeltaTapeAlert
	
	// Pattern-based alerts
	if len(metrics.ActivePatterns) > 0 {
		strongestPattern := metrics.ActivePatterns[0]
		for _, pattern := range metrics.ActivePatterns {
			if pattern.Strength > strongestPattern.Strength {
				strongestPattern = pattern
			}
		}
		
		alert = &DeltaTapeAlert{
			Symbol:          dta.symbol,
			AlertType:       "PATTERN_DETECTED",
			DetectedPattern: &strongestPattern,
			FlowSignal:      dta.patternToSignal(strongestPattern),
			Urgency:         dta.calculateUrgency(strongestPattern.Strength),
			ExpectedImpact:  dta.calculateExpectedImpact(strongestPattern),
			Confidence:      strongestPattern.Confidence,
			Timestamp:       time.Now(),
		}
	}
	
	// Flow shift alerts
	if metrics.FlowMomentum == "STRONG_BUY" || metrics.FlowMomentum == "STRONG_SELL" {
		if alert == nil {
			alert = &DeltaTapeAlert{
				Symbol:     dta.symbol,
				AlertType:  "FLOW_SHIFT",
				FlowSignal: metrics.FlowMomentum,
				Urgency:    "HIGH",
				Confidence: metrics.FlowIntensity,
				Timestamp:  time.Now(),
			}
		}
	}
	
	// Divergence alerts
	if metrics.FlowDivergence {
		if alert == nil {
			alert = &DeltaTapeAlert{
				Symbol:     dta.symbol,
				AlertType:  "DIVERGENCE",
				FlowSignal: "CAUTION",
				Urgency:    "MEDIUM",
				Confidence: 0.7,
				Timestamp:  time.Now(),
			}
		}
	}
	
	if alert != nil {
		// Complete alert fields
		alert.RecommendedAction = dta.determineRecommendedAction(alert.FlowSignal)
		alert.RiskLevel = dta.assessRiskLevel(metrics)
		alert.ExpectedImpact = dta.calculateExpectedImpact(*alert.DetectedPattern)
	}
	
	return alert
}

// Helper methods for alert generation
func (dta *DeltaTapeAnalyzer) patternToSignal(pattern DeltaTapePattern) string {
	switch pattern.PatternType {
	case "ACCUMULATION":
		return "BUY"
	case "DISTRIBUTION":
		return "SELL"
	case "BREAKOUT_UP":
		return "BUY"
	case "BREAKOUT_DOWN":
		return "SELL"
	case "ABSORPTION":
		return "NEUTRAL"
	default:
		return "NEUTRAL"
	}
}

func (dta *DeltaTapeAnalyzer) calculateUrgency(strength float64) string {
	if strength >= 0.8 {
		return "CRITICAL"
	} else if strength >= 0.6 {
		return "HIGH"
	} else if strength >= 0.4 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

func (dta *DeltaTapeAnalyzer) calculateExpectedImpact(pattern DeltaTapePattern) string {
	if pattern.Strength >= 0.8 {
		return "MAJOR"
	} else if pattern.Strength >= 0.6 {
		return "SIGNIFICANT"
	} else if pattern.Strength >= 0.4 {
		return "MODERATE"
	} else {
		return "MINIMAL"
	}
}

func (dta *DeltaTapeAnalyzer) determineRecommendedAction(signal string) string {
	switch signal {
	case "BUY", "STRONG_BUY":
		return "FOLLOW"
	case "SELL", "STRONG_SELL":
		return "FOLLOW"
	case "CAUTION":
		return "WAIT"
	default:
		return "WAIT"
	}
}

func (dta *DeltaTapeAnalyzer) assessRiskLevel(metrics *DeltaFlowMetrics) string {
	riskScore := 0.0
	
	if metrics.FlowIntensity > 0.7 {
		riskScore += 0.3
	}
	
	if metrics.FlowDivergence {
		riskScore += 0.4
	}
	
	if len(metrics.ActivePatterns) > 3 {
		riskScore += 0.3
	}
	
	if riskScore >= 0.7 {
		return "HIGH"
	} else if riskScore >= 0.4 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// publishFlowMetrics publishes flow metrics to Redis
func (dta *DeltaTapeAnalyzer) publishFlowMetrics(metrics *DeltaFlowMetrics) error {
	data, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal flow metrics: %w", err)
	}
	
	channel := fmt.Sprintf("%s:delta_flow", dta.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = dta.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish flow metrics: %w", err)
	}
	
	log.Printf("📊 Delta Flow: %s | Momentum: %s | Velocity: %.2f | CumDelta: %.2f | Patterns: %d",
		metrics.Symbol, metrics.FlowMomentum, metrics.DeltaVelocity, 
		metrics.CumulativeDelta, len(metrics.ActivePatterns))
	
	return nil
}

// publishDeltaTapeAlert publishes delta tape alert to Redis
func (dta *DeltaTapeAnalyzer) publishDeltaTapeAlert(alert *DeltaTapeAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal delta tape alert: %w", err)
	}
	
	channel := fmt.Sprintf("%s:delta_alert", dta.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = dta.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish delta tape alert: %w", err)
	}
	
	log.Printf("🚨 Delta Alert: %s | %s | Signal: %s | Urgency: %s | Confidence: %.3f",
		alert.Symbol, alert.AlertType, alert.FlowSignal, alert.Urgency, alert.Confidence)
	
	return nil
}

// Start begins the real delta tape analysis process
func (dta *DeltaTapeAnalyzer) Start(ctx context.Context) error {
	log.Printf("📊 Starting Delta Tape Analyzer for %s", dta.symbol)
	
	// Subscribe to real trade events
	channel := fmt.Sprintf("%s:trade", dta.symbol)
	pubsub := dta.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := dta.ProcessTrade([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Delta tape processing error for %s: %v", dta.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the delta tape analyzer
func (dta *DeltaTapeAnalyzer) Stop() error {
	log.Printf("🛑 Stopping Delta Tape Analyzer for %s", dta.symbol)
	return nil
}

// Health returns the health status
func (dta *DeltaTapeAnalyzer) Health() bool {
	dta.mu.RLock()
	defer dta.mu.RUnlock()
	
	// Check if we have recent tape data
	if len(dta.deltaTape) == 0 {
		return true // No data is normal
	}
	
	// Check if latest entry is recent (within last 2 minutes)
	latestEntry := dta.deltaTape[len(dta.deltaTape)-1]
	return time.Since(latestEntry.Timestamp) < 2*time.Minute
}

// Name returns the service name
func (dta *DeltaTapeAnalyzer) Name() string {
	return fmt.Sprintf("DeltaTapeAnalyzer-%s", dta.symbol)
} 