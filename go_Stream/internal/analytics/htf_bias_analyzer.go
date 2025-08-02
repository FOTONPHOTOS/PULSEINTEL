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

// TimeframeData represents real price data for a specific timeframe
type TimeframeData struct {
	Timeframe    string    `json:"timeframe"`    // "1m", "5m", "15m", "1h", "4h", "1d"
	Open         float64   `json:"open"`
	High         float64   `json:"high"`
	Low          float64   `json:"low"`
	Close        float64   `json:"close"`
	Volume       float64   `json:"volume"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	IsComplete   bool      `json:"is_complete"`
}

// TrendAnalysis represents trend analysis for a timeframe
type TrendAnalysis struct {
	Timeframe      string  `json:"timeframe"`
	Direction      string  `json:"direction"`      // "BULLISH", "BEARISH", "NEUTRAL"
	Strength       float64 `json:"strength"`       // 0.0-1.0
	Momentum       float64 `json:"momentum"`       // -1.0 to 1.0
	TrendAge       int     `json:"trend_age"`      // Candles since trend started
	Confidence     float64 `json:"confidence"`     // 0.0-1.0
	SupportLevel   float64 `json:"support_level"`
	ResistanceLevel float64 `json:"resistance_level"`
}

// HTFBiasSignal represents the overall HTF bias signal
type HTFBiasSignal struct {
	Symbol           string          `json:"symbol"`
	OverallBias      string          `json:"overall_bias"`      // "BULLISH", "BEARISH", "NEUTRAL"
	BiasStrength     float64         `json:"bias_strength"`     // 0.0-1.0
	BiasConfidence   float64         `json:"bias_confidence"`   // 0.0-1.0
	TimeframeAnalysis map[string]TrendAnalysis `json:"timeframe_analysis"`
	AlignmentScore   float64         `json:"alignment_score"`   // How well timeframes align
	RecommendedAction string         `json:"recommended_action"` // "FOLLOW_TREND", "WAIT", "COUNTER_TREND"
	RiskLevel        string          `json:"risk_level"`        // "LOW", "MEDIUM", "HIGH"
	Reasoning        string          `json:"reasoning"`
	Timestamp        time.Time       `json:"timestamp"`
}

// HTFBiasAnalyzer analyzes higher timeframe bias from real market data
type HTFBiasAnalyzer struct {
	redisClient    *redis.Client
	symbol         string
	
	// Timeframe data storage
	timeframeData  map[string]*TimeframeData
	historicalData map[string][]TimeframeData
	maxHistory     int
	
	// Supported timeframes (in ascending order)
	timeframes     []string
	timeframeDurations map[string]time.Duration
	
	// Analysis parameters
	trendThreshold    float64 // Minimum change for trend detection
	strengthThreshold float64 // Minimum strength for significant trend
	alignmentWeight   map[string]float64 // Weight for each timeframe
	
	mu               sync.RWMutex
	lastAnalysis     time.Time
	analysisInterval time.Duration
}

// NewHTFBiasAnalyzer creates a new real HTF bias analyzer
func NewHTFBiasAnalyzer(redisClient *redis.Client, symbol string) *HTFBiasAnalyzer {
	timeframes := []string{"1m", "5m", "15m", "1h", "4h", "1d"}
	
	return &HTFBiasAnalyzer{
		redisClient:    redisClient,
		symbol:         symbol,
		maxHistory:     100,
		timeframes:     timeframes,
		trendThreshold: 0.01, // 1% minimum change
		strengthThreshold: 0.3, // 30% minimum strength
		analysisInterval: 30 * time.Second,
		
		// Initialize data storage
		timeframeData:  make(map[string]*TimeframeData),
		historicalData: make(map[string][]TimeframeData),
		
		// Timeframe durations
		timeframeDurations: map[string]time.Duration{
			"1m":  1 * time.Minute,
			"5m":  5 * time.Minute,
			"15m": 15 * time.Minute,
			"1h":  1 * time.Hour,
			"4h":  4 * time.Hour,
			"1d":  24 * time.Hour,
		},
		
		// Timeframe weights (higher timeframes have more weight)
		alignmentWeight: map[string]float64{
			"1m":  0.05,
			"5m":  0.10,
			"15m": 0.15,
			"1h":  0.25,
			"4h":  0.30,
			"1d":  0.15,
		},
	}
}

// ProcessPriceData processes real price data and updates timeframe candles
func (htf *HTFBiasAnalyzer) ProcessPriceData(priceData []byte) error {
	htf.mu.Lock()
	defer htf.mu.Unlock()
	
	// Parse real price data
	var trade struct {
		Symbol    string    `json:"symbol"`
		Price     float64   `json:"price"`
		Volume    float64   `json:"volume"`
		Timestamp time.Time `json:"timestamp"`
	}
	
	if err := json.Unmarshal(priceData, &trade); err != nil {
		return fmt.Errorf("failed to parse price data: %w", err)
	}
	
	// Validate real data
	if trade.Symbol != htf.symbol || trade.Price <= 0 {
		return fmt.Errorf("invalid price data: symbol=%s, price=%f", trade.Symbol, trade.Price)
	}
	
	// Update all timeframes
	for _, tf := range htf.timeframes {
		htf.updateTimeframeData(tf, trade.Price, trade.Volume, trade.Timestamp)
	}
	
	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(htf.lastAnalysis) >= htf.analysisInterval {
		signal := htf.generateHTFBiasSignal()
		if signal != nil {
			htf.publishHTFBias(signal)
		}
		htf.lastAnalysis = now
	}
	
	return nil
}

// updateTimeframeData updates candle data for a specific timeframe
func (htf *HTFBiasAnalyzer) updateTimeframeData(timeframe string, price, volume float64, timestamp time.Time) {
	duration := htf.timeframeDurations[timeframe]
	
	// Calculate candle start time
	candleStart := htf.getCandleStartTime(timestamp, duration)
	candleEnd := candleStart.Add(duration)
	
	// Get or create current candle
	current := htf.timeframeData[timeframe]
	
	// Check if we need a new candle
	if current == nil || timestamp.After(current.EndTime) {
		// Complete previous candle if it exists
		if current != nil && !current.IsComplete {
			current.IsComplete = true
			htf.addToHistory(timeframe, *current)
		}
		
		// Create new candle
		current = &TimeframeData{
			Timeframe: timeframe,
			Open:      price,
			High:      price,
			Low:       price,
			Close:     price,
			Volume:    volume,
			StartTime: candleStart,
			EndTime:   candleEnd,
			IsComplete: false,
		}
		htf.timeframeData[timeframe] = current
	} else {
		// Update existing candle
		if price > current.High {
			current.High = price
		}
		if price < current.Low {
			current.Low = price
		}
		current.Close = price
		current.Volume += volume
	}
}

// getCandleStartTime calculates the start time for a candle
func (htf *HTFBiasAnalyzer) getCandleStartTime(timestamp time.Time, duration time.Duration) time.Time {
	switch duration {
	case 1 * time.Minute:
		return timestamp.Truncate(time.Minute)
	case 5 * time.Minute:
		return timestamp.Truncate(5 * time.Minute)
	case 15 * time.Minute:
		return timestamp.Truncate(15 * time.Minute)
	case 1 * time.Hour:
		return timestamp.Truncate(time.Hour)
	case 4 * time.Hour:
		return timestamp.Truncate(4 * time.Hour)
	case 24 * time.Hour:
		return timestamp.Truncate(24 * time.Hour)
	default:
		return timestamp.Truncate(duration)
	}
}

// addToHistory adds completed candle to historical data
func (htf *HTFBiasAnalyzer) addToHistory(timeframe string, candle TimeframeData) {
	if htf.historicalData[timeframe] == nil {
		htf.historicalData[timeframe] = make([]TimeframeData, 0, htf.maxHistory)
	}
	
	htf.historicalData[timeframe] = append(htf.historicalData[timeframe], candle)
	
	// Keep only recent history
	if len(htf.historicalData[timeframe]) > htf.maxHistory {
		htf.historicalData[timeframe] = htf.historicalData[timeframe][1:]
	}
}

// generateHTFBiasSignal generates comprehensive HTF bias signal from real data
func (htf *HTFBiasAnalyzer) generateHTFBiasSignal() *HTFBiasSignal {
	timeframeAnalysis := make(map[string]TrendAnalysis)
	
	// Analyze each timeframe
	for _, tf := range htf.timeframes {
		analysis := htf.analyzeTimeframeTrend(tf)
		if analysis != nil {
			timeframeAnalysis[tf] = *analysis
		}
	}
	
	// Calculate overall bias
	overallBias, biasStrength, biasConfidence := htf.calculateOverallBias(timeframeAnalysis)
	
	// Calculate alignment score
	alignmentScore := htf.calculateAlignmentScore(timeframeAnalysis)
	
	// Determine recommended action
	recommendedAction := htf.determineRecommendedAction(overallBias, biasStrength, alignmentScore)
	
	// Assess risk level
	riskLevel := htf.assessRiskLevel(biasConfidence, alignmentScore)
	
	// Generate reasoning
	reasoning := htf.generateReasoning(overallBias, biasStrength, alignmentScore, timeframeAnalysis)
	
	return &HTFBiasSignal{
		Symbol:            htf.symbol,
		OverallBias:       overallBias,
		BiasStrength:      biasStrength,
		BiasConfidence:    biasConfidence,
		TimeframeAnalysis: timeframeAnalysis,
		AlignmentScore:    alignmentScore,
		RecommendedAction: recommendedAction,
		RiskLevel:         riskLevel,
		Reasoning:         reasoning,
		Timestamp:         time.Now(),
	}
}

// analyzeTimeframeTrend analyzes trend for a specific timeframe
func (htf *HTFBiasAnalyzer) analyzeTimeframeTrend(timeframe string) *TrendAnalysis {
	history := htf.historicalData[timeframe]
	if len(history) < 10 {
		return nil
	}
	
	// Get recent candles for analysis
	recentCandles := history[len(history)-20:]
	if len(recentCandles) < 10 {
		recentCandles = history
	}
	
	// Calculate trend direction and strength
	direction, strength := htf.calculateTrendDirection(recentCandles)
	
	// Calculate momentum
	momentum := htf.calculateMomentum(recentCandles)
	
	// Calculate trend age
	trendAge := htf.calculateTrendAge(recentCandles, direction)
	
	// Calculate confidence
	confidence := htf.calculateTrendConfidence(recentCandles, direction, strength)
	
	// Find support and resistance levels
	supportLevel, resistanceLevel := htf.findSupportResistance(recentCandles)
	
	return &TrendAnalysis{
		Timeframe:       timeframe,
		Direction:       direction,
		Strength:        strength,
		Momentum:        momentum,
		TrendAge:        trendAge,
		Confidence:      confidence,
		SupportLevel:    supportLevel,
		ResistanceLevel: resistanceLevel,
	}
}

// calculateTrendDirection calculates trend direction and strength from real candle data
func (htf *HTFBiasAnalyzer) calculateTrendDirection(candles []TimeframeData) (string, float64) {
	if len(candles) < 3 {
		return "NEUTRAL", 0.0
	}
	
	// Calculate price change over the period
	startPrice := candles[0].Close
	endPrice := candles[len(candles)-1].Close
	priceChange := (endPrice - startPrice) / startPrice
	
	// Calculate trend strength based on consistent movement
	upCandles := 0
	downCandles := 0
	
	for i := 1; i < len(candles); i++ {
		if candles[i].Close > candles[i-1].Close {
			upCandles++
		} else if candles[i].Close < candles[i-1].Close {
			downCandles++
		}
	}
	
	totalCandles := len(candles) - 1
	consistency := 0.0
	
	if math.Abs(priceChange) >= htf.trendThreshold {
		if priceChange > 0 {
			consistency = float64(upCandles) / float64(totalCandles)
			return "BULLISH", consistency
		} else {
			consistency = float64(downCandles) / float64(totalCandles)
			return "BEARISH", consistency
		}
	}
	
	return "NEUTRAL", 0.0
}

// calculateMomentum calculates momentum from real candle data
func (htf *HTFBiasAnalyzer) calculateMomentum(candles []TimeframeData) float64 {
	if len(candles) < 5 {
		return 0.0
	}
	
	// Compare recent momentum to earlier momentum
	recentPeriod := candles[len(candles)-3:]
	earlierPeriod := candles[len(candles)-6 : len(candles)-3]
	
	recentChange := (recentPeriod[len(recentPeriod)-1].Close - recentPeriod[0].Close) / recentPeriod[0].Close
	earlierChange := (earlierPeriod[len(earlierPeriod)-1].Close - earlierPeriod[0].Close) / earlierPeriod[0].Close
	
	// Momentum is the difference between recent and earlier momentum
	momentum := recentChange - earlierChange
	
	// Normalize to -1.0 to 1.0 range
	return math.Max(-1.0, math.Min(1.0, momentum*10))
}

// calculateTrendAge calculates how long the current trend has been active
func (htf *HTFBiasAnalyzer) calculateTrendAge(candles []TimeframeData, direction string) int {
	if len(candles) < 2 || direction == "NEUTRAL" {
		return 0
	}
	
	age := 0
	for i := len(candles) - 1; i > 0; i-- {
		currentChange := candles[i].Close - candles[i-1].Close
		
		if direction == "BULLISH" && currentChange > 0 {
			age++
		} else if direction == "BEARISH" && currentChange < 0 {
			age++
		} else {
			break
		}
	}
	
	return age
}

// calculateTrendConfidence calculates confidence in the trend analysis
func (htf *HTFBiasAnalyzer) calculateTrendConfidence(candles []TimeframeData, direction string, strength float64) float64 {
	if direction == "NEUTRAL" {
		return 0.5
	}
	
	// Base confidence from strength
	confidence := strength
	
	// Adjust for volume confirmation
	if len(candles) >= 2 {
		recentVolume := 0.0
		earlierVolume := 0.0
		
		halfPoint := len(candles) / 2
		for i := halfPoint; i < len(candles); i++ {
			recentVolume += candles[i].Volume
		}
		for i := 0; i < halfPoint; i++ {
			earlierVolume += candles[i].Volume
		}
		
		if recentVolume > earlierVolume {
			confidence *= 1.2 // Volume confirmation increases confidence
		}
	}
	
	return math.Min(confidence, 1.0)
}

// findSupportResistance finds support and resistance levels from real candle data
func (htf *HTFBiasAnalyzer) findSupportResistance(candles []TimeframeData) (float64, float64) {
	if len(candles) < 5 {
		return 0.0, 0.0
	}
	
	// Find recent lows for support
	support := candles[0].Low
	for _, candle := range candles {
		if candle.Low < support {
			support = candle.Low
		}
	}
	
	// Find recent highs for resistance
	resistance := candles[0].High
	for _, candle := range candles {
		if candle.High > resistance {
			resistance = candle.High
		}
	}
	
	return support, resistance
}

// calculateOverallBias calculates overall bias from timeframe analysis
func (htf *HTFBiasAnalyzer) calculateOverallBias(analysis map[string]TrendAnalysis) (string, float64, float64) {
	if len(analysis) == 0 {
		return "NEUTRAL", 0.0, 0.0
	}
	
	bullishScore := 0.0
	bearishScore := 0.0
	totalWeight := 0.0
	totalConfidence := 0.0
	
	for tf, trend := range analysis {
		weight := htf.alignmentWeight[tf]
		totalWeight += weight
		totalConfidence += trend.Confidence * weight
		
		switch trend.Direction {
		case "BULLISH":
			bullishScore += trend.Strength * weight
		case "BEARISH":
			bearishScore += trend.Strength * weight
		}
	}
	
	if totalWeight == 0 {
		return "NEUTRAL", 0.0, 0.0
	}
	
	avgConfidence := totalConfidence / totalWeight
	
	// Determine overall bias
	if bullishScore > bearishScore && (bullishScore-bearishScore)/totalWeight > htf.strengthThreshold {
		return "BULLISH", (bullishScore - bearishScore) / totalWeight, avgConfidence
	} else if bearishScore > bullishScore && (bearishScore-bullishScore)/totalWeight > htf.strengthThreshold {
		return "BEARISH", (bearishScore - bullishScore) / totalWeight, avgConfidence
	} else {
		return "NEUTRAL", 0.0, avgConfidence
	}
}

// calculateAlignmentScore calculates how well timeframes align
func (htf *HTFBiasAnalyzer) calculateAlignmentScore(analysis map[string]TrendAnalysis) float64 {
	if len(analysis) < 2 {
		return 0.0
	}
	
	directions := make(map[string]int)
	totalWeight := 0.0
	
	for tf, trend := range analysis {
		weight := htf.alignmentWeight[tf]
		directions[trend.Direction] += int(weight * 100)
		totalWeight += weight
	}
	
	// Find the dominant direction
	maxCount := 0
	for _, count := range directions {
		if count > maxCount {
			maxCount = count
		}
	}
	
	// Alignment score is the percentage of weight in the dominant direction
	return float64(maxCount) / (totalWeight * 100)
}

// determineRecommendedAction determines recommended trading action
func (htf *HTFBiasAnalyzer) determineRecommendedAction(bias string, strength, alignment float64) string {
	if bias == "NEUTRAL" || strength < htf.strengthThreshold {
		return "WAIT"
	}
	
	if alignment >= 0.7 && strength >= 0.6 {
		return "FOLLOW_TREND"
	} else if alignment < 0.4 {
		return "WAIT"
	} else {
		return "FOLLOW_TREND"
	}
}

// assessRiskLevel assesses risk level based on confidence and alignment
func (htf *HTFBiasAnalyzer) assessRiskLevel(confidence, alignment float64) string {
	riskScore := (confidence + alignment) / 2.0
	
	if riskScore >= 0.8 {
		return "LOW"
	} else if riskScore >= 0.6 {
		return "MEDIUM"
	} else {
		return "HIGH"
	}
}

// generateReasoning generates human-readable reasoning
func (htf *HTFBiasAnalyzer) generateReasoning(bias string, strength, alignment float64, analysis map[string]TrendAnalysis) string {
	alignedTimeframes := make([]string, 0)
	conflictingTimeframes := make([]string, 0)
	
	for tf, trend := range analysis {
		if trend.Direction == bias {
			alignedTimeframes = append(alignedTimeframes, tf)
		} else if trend.Direction != "NEUTRAL" {
			conflictingTimeframes = append(conflictingTimeframes, tf)
		}
	}
	
	reasoning := fmt.Sprintf("HTF Bias: %s (Strength: %.2f, Alignment: %.2f). ", bias, strength, alignment)
	
	if len(alignedTimeframes) > 0 {
		reasoning += fmt.Sprintf("Supporting timeframes: %v. ", alignedTimeframes)
	}
	
	if len(conflictingTimeframes) > 0 {
		reasoning += fmt.Sprintf("Conflicting timeframes: %v. ", conflictingTimeframes)
	}
	
	return reasoning
}

// publishHTFBias publishes HTF bias signal to Redis
func (htf *HTFBiasAnalyzer) publishHTFBias(signal *HTFBiasSignal) error {
	data, err := json.Marshal(signal)
	if err != nil {
		return fmt.Errorf("failed to marshal HTF bias signal: %w", err)
	}
	
	channel := fmt.Sprintf("%s:htf_bias", htf.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = htf.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish HTF bias signal: %w", err)
	}
	
	log.Printf("📈 HTF Bias: %s | %s | Strength: %.3f | Alignment: %.3f | Action: %s",
		signal.Symbol, signal.OverallBias, signal.BiasStrength, signal.AlignmentScore, signal.RecommendedAction)
	
	return nil
}

// Start begins the real HTF bias analysis process
func (htf *HTFBiasAnalyzer) Start(ctx context.Context) error {
	log.Printf("📈 Starting HTF Bias Analyzer for %s", htf.symbol)
	
	// Subscribe to real price/trade events
	channel := fmt.Sprintf("%s:trade", htf.symbol)
	pubsub := htf.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := htf.ProcessPriceData([]byte(msg.Payload)); err != nil {
				log.Printf("❌ HTF bias processing error for %s: %v", htf.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the HTF bias analyzer
func (htf *HTFBiasAnalyzer) Stop() error {
	log.Printf("🛑 Stopping HTF Bias Analyzer for %s", htf.symbol)
	return nil
}

// Health returns the health status
func (htf *HTFBiasAnalyzer) Health() bool {
	htf.mu.RLock()
	defer htf.mu.RUnlock()
	
	// Check if we have recent data for at least one timeframe
	for _, data := range htf.timeframeData {
		if data != nil && time.Since(data.StartTime) < 10*time.Minute {
			return true
		}
	}
	
	return false
}

// Name returns the service name
func (htf *HTFBiasAnalyzer) Name() string {
	return fmt.Sprintf("HTFBiasAnalyzer-%s", htf.symbol)
} 