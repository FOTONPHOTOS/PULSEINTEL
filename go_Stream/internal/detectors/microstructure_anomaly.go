package detectors

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

// OrderFlowEvent represents real order flow data
type OrderFlowEvent struct {
	Symbol      string    `json:"symbol"`
	Price       float64   `json:"price"`
	Volume      float64   `json:"volume"`
	Side        string    `json:"side"`        // "buy" or "sell"
	OrderType   string    `json:"order_type"`  // "market" or "limit"
	Timestamp   time.Time `json:"timestamp"`
	EventID     string    `json:"event_id"`
}

// MicrostructurePattern represents detected microstructure patterns
type MicrostructurePattern struct {
	PatternType   string    `json:"pattern_type"`   // "SPOOFING", "LAYERING", "MOMENTUM_IGNITION", "ICEBERG"
	Confidence    float64   `json:"confidence"`     // 0.0-1.0
	Severity      string    `json:"severity"`       // "LOW", "MEDIUM", "HIGH", "CRITICAL"
	PriceImpact   float64   `json:"price_impact"`   // Estimated price impact
	VolumeImpact  float64   `json:"volume_impact"`  // Volume involved
	Duration      time.Duration `json:"duration"`   // Pattern duration
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Description   string    `json:"description"`
}

// StructuralBreak represents detected structural market breaks
type StructuralBreak struct {
	BreakType     string    `json:"break_type"`     // "LIQUIDITY_SHOCK", "REGIME_CHANGE", "VOLATILITY_SPIKE"
	BreakLevel    float64   `json:"break_level"`    // Price level where break occurred
	Magnitude     float64   `json:"magnitude"`      // Strength of the break
	Confidence    float64   `json:"confidence"`     // Statistical confidence
	PreBreakState string    `json:"pre_break_state"` // Market state before break
	PostBreakState string   `json:"post_break_state"` // Market state after break
	Timestamp     time.Time `json:"timestamp"`
	Impact        string    `json:"impact"`         // "TEMPORARY", "PERSISTENT", "STRUCTURAL"
}

// MicrostructureAnomalyAlert represents comprehensive anomaly detection
type MicrostructureAnomalyAlert struct {
	Symbol              string                  `json:"symbol"`
	Patterns            []MicrostructurePattern `json:"patterns"`
	StructuralBreaks    []StructuralBreak       `json:"structural_breaks"`
	AnomalyScore        float64                 `json:"anomaly_score"`    // 0.0-1.0
	RiskLevel           string                  `json:"risk_level"`       // "LOW", "MEDIUM", "HIGH", "CRITICAL"
	RecommendedAction   string                  `json:"recommended_action"` // "MONITOR", "REDUCE_SIZE", "HALT_TRADING"
	MarketQuality       string                  `json:"market_quality"`   // "NORMAL", "DEGRADED", "DISRUPTED"
	Timestamp           time.Time               `json:"timestamp"`
}

// MicrostructureAnomalyDetector detects real microstructure anomalies
type MicrostructureAnomalyDetector struct {
	redisClient    *redis.Client
	symbol         string
	
	// Real order flow storage
	recentOrderFlow []OrderFlowEvent
	maxOrderFlow    int
	orderFlowWindow time.Duration
	
	// Pattern detection parameters
	spoofingThreshold    float64 // Volume threshold for spoofing detection
	layeringThreshold    int     // Number of orders for layering
	icebergThreshold     float64 // Fragment size threshold
	momentumThreshold    float64 // Price movement threshold
	
	// Structural break detection
	liquidityWindow      time.Duration
	volatilityWindow     time.Duration
	regimeWindow         time.Duration
	breakConfidence      float64
	
	// Market state tracking
	currentLiquidity     float64
	currentVolatility    float64
	currentSpread        float64
	baselineMetrics      map[string]float64
	
	// Pattern storage
	activePatterns       []MicrostructurePattern
	recentBreaks         []StructuralBreak
	maxPatterns          int
	maxBreaks            int
	
	mu                   sync.RWMutex
	lastAnalysis         time.Time
	analysisInterval     time.Duration
}

// NewMicrostructureAnomalyDetector creates a new real microstructure anomaly detector
func NewMicrostructureAnomalyDetector(redisClient *redis.Client, symbol string) *MicrostructureAnomalyDetector {
	return &MicrostructureAnomalyDetector{
		redisClient:       redisClient,
		symbol:            symbol,
		maxOrderFlow:      5000,
		orderFlowWindow:   10 * time.Minute,
		spoofingThreshold: 10000.0, // $10k volume threshold
		layeringThreshold: 5,       // 5+ orders
		icebergThreshold:  0.1,     // 10% of average order size
		momentumThreshold: 0.005,   // 0.5% price movement
		liquidityWindow:   5 * time.Minute,
		volatilityWindow:  1 * time.Minute,
		regimeWindow:      15 * time.Minute,
		breakConfidence:   0.95,    // 95% confidence
		maxPatterns:       50,
		maxBreaks:         20,
		analysisInterval:  10 * time.Second,
		recentOrderFlow:   make([]OrderFlowEvent, 0, 5000),
		activePatterns:    make([]MicrostructurePattern, 0, 50),
		recentBreaks:      make([]StructuralBreak, 0, 20),
		baselineMetrics:   make(map[string]float64),
	}
}

// ProcessOrderFlow processes real order flow events for anomaly detection
func (mad *MicrostructureAnomalyDetector) ProcessOrderFlow(orderFlowData []byte) error {
	mad.mu.Lock()
	defer mad.mu.Unlock()
	
	// Parse real order flow data
	var event OrderFlowEvent
	if err := json.Unmarshal(orderFlowData, &event); err != nil {
		return fmt.Errorf("failed to parse order flow: %w", err)
	}
	
	// Validate real data
	if event.Symbol != mad.symbol || event.Price <= 0 || event.Volume <= 0 {
		return fmt.Errorf("invalid order flow data: symbol=%s, price=%f, volume=%f", 
			event.Symbol, event.Price, event.Volume)
	}
	
	// Add to recent order flow
	mad.recentOrderFlow = append(mad.recentOrderFlow, event)
	
	// Clean old order flow data
	mad.cleanOldOrderFlow()
	
	// Update market state metrics
	mad.updateMarketMetrics()
	
	// Perform real-time analysis
	now := time.Now()
	if now.Sub(mad.lastAnalysis) >= mad.analysisInterval {
		mad.performAnomalyDetection()
		mad.lastAnalysis = now
	}
	
	return nil
}

// cleanOldOrderFlow removes old order flow events
func (mad *MicrostructureAnomalyDetector) cleanOldOrderFlow() {
	cutoff := time.Now().Add(-mad.orderFlowWindow)
	
	validEvents := make([]OrderFlowEvent, 0, len(mad.recentOrderFlow))
	for _, event := range mad.recentOrderFlow {
		if event.Timestamp.After(cutoff) {
			validEvents = append(validEvents, event)
		}
	}
	mad.recentOrderFlow = validEvents
	
	// Limit memory usage
	if len(mad.recentOrderFlow) > mad.maxOrderFlow {
		mad.recentOrderFlow = mad.recentOrderFlow[len(mad.recentOrderFlow)-mad.maxOrderFlow:]
	}
}

// updateMarketMetrics updates real-time market state metrics
func (mad *MicrostructureAnomalyDetector) updateMarketMetrics() {
	if len(mad.recentOrderFlow) < 10 {
		return
	}
	
	// Calculate current liquidity (volume in recent window)
	recentWindow := 1 * time.Minute
	cutoff := time.Now().Add(-recentWindow)
	
	totalVolume := 0.0
	prices := make([]float64, 0)
	
	for _, event := range mad.recentOrderFlow {
		if event.Timestamp.After(cutoff) {
			totalVolume += event.Volume
			prices = append(prices, event.Price)
		}
	}
	
	mad.currentLiquidity = totalVolume
	
	// Calculate current volatility (price standard deviation)
	if len(prices) > 1 {
		mad.currentVolatility = mad.calculateStandardDeviation(prices)
	}
	
	// Calculate current spread (price range)
	if len(prices) > 0 {
		sort.Float64s(prices)
		mad.currentSpread = prices[len(prices)-1] - prices[0]
	}
	
	// Update baseline metrics if not set
	if mad.baselineMetrics["liquidity"] == 0 {
		mad.baselineMetrics["liquidity"] = mad.currentLiquidity
		mad.baselineMetrics["volatility"] = mad.currentVolatility
		mad.baselineMetrics["spread"] = mad.currentSpread
	}
}

// calculateStandardDeviation calculates standard deviation of prices
func (mad *MicrostructureAnomalyDetector) calculateStandardDeviation(prices []float64) float64 {
	if len(prices) < 2 {
		return 0.0
	}
	
	// Calculate mean
	sum := 0.0
	for _, price := range prices {
		sum += price
	}
	mean := sum / float64(len(prices))
	
	// Calculate variance
	variance := 0.0
	for _, price := range prices {
		diff := price - mean
		variance += diff * diff
	}
	variance /= float64(len(prices))
	
	return math.Sqrt(variance)
}

// performAnomalyDetection performs comprehensive anomaly detection
func (mad *MicrostructureAnomalyDetector) performAnomalyDetection() {
	if len(mad.recentOrderFlow) < 20 {
		return
	}
	
	// Detect microstructure patterns
	newPatterns := mad.detectMicrostructurePatterns()
	
	// Detect structural breaks
	newBreaks := mad.detectStructuralBreaks()
	
	// Update active patterns and breaks
	mad.updateActivePatterns(newPatterns)
	mad.updateRecentBreaks(newBreaks)
	
	// Generate anomaly alert if significant patterns detected
	if len(newPatterns) > 0 || len(newBreaks) > 0 {
		alert := mad.generateAnomalyAlert()
		if alert != nil {
			mad.publishAnomalyAlert(alert)
		}
	}
}

// detectMicrostructurePatterns detects various microstructure patterns
func (mad *MicrostructureAnomalyDetector) detectMicrostructurePatterns() []MicrostructurePattern {
	var patterns []MicrostructurePattern
	
	// Detect spoofing patterns
	spoofingPatterns := mad.detectSpoofingPatterns()
	patterns = append(patterns, spoofingPatterns...)
	
	// Detect layering patterns
	layeringPatterns := mad.detectLayeringPatterns()
	patterns = append(patterns, layeringPatterns...)
	
	// Detect iceberg patterns
	icebergPatterns := mad.detectIcebergPatterns()
	patterns = append(patterns, icebergPatterns...)
	
	// Detect momentum ignition patterns
	momentumPatterns := mad.detectMomentumIgnitionPatterns()
	patterns = append(patterns, momentumPatterns...)
	
	return patterns
}

// detectSpoofingPatterns detects order spoofing patterns
func (mad *MicrostructureAnomalyDetector) detectSpoofingPatterns() []MicrostructurePattern {
	var patterns []MicrostructurePattern
	
	// Look for large orders that appear and disappear quickly
	orderLifetime := make(map[string]time.Duration)
	orderVolumes := make(map[string]float64)
	
	// Group orders by similar characteristics
	for _, event := range mad.recentOrderFlow {
		if event.OrderType == "limit" && event.Volume*event.Price >= mad.spoofingThreshold {
			key := fmt.Sprintf("%.2f-%.0f", event.Price, event.Volume)
			
			if _, exists := orderLifetime[key]; !exists {
				orderLifetime[key] = time.Since(event.Timestamp)
				orderVolumes[key] = event.Volume
			}
		}
	}
	
	// Identify potential spoofing (large orders with short lifetime)
	for key, lifetime := range orderLifetime {
		if lifetime < 30*time.Second && orderVolumes[key]*100000 >= mad.spoofingThreshold {
			confidence := math.Min(1.0, float64(orderVolumes[key])/10000.0)
			
			patterns = append(patterns, MicrostructurePattern{
				PatternType:  "SPOOFING",
				Confidence:   confidence,
				Severity:     mad.calculateSeverity(confidence),
				PriceImpact:  0.0, // Spoofing typically has no actual price impact
				VolumeImpact: orderVolumes[key],
				Duration:     lifetime,
				StartTime:    time.Now().Add(-lifetime),
				EndTime:      time.Now(),
				Description:  fmt.Sprintf("Large order ($%.0f) appeared and disappeared quickly (%v)", orderVolumes[key]*100000, lifetime),
			})
		}
	}
	
	return patterns
}

// detectLayeringPatterns detects order layering patterns
func (mad *MicrostructureAnomalyDetector) detectLayeringPatterns() []MicrostructurePattern {
	var patterns []MicrostructurePattern
	
	// Group orders by price levels
	priceLevels := make(map[float64][]OrderFlowEvent)
	
	for _, event := range mad.recentOrderFlow {
		if event.OrderType == "limit" {
			// Round price to nearest cent for grouping
			roundedPrice := math.Round(event.Price*100) / 100
			priceLevels[roundedPrice] = append(priceLevels[roundedPrice], event)
		}
	}
	
	// Look for multiple large orders at similar price levels
	for price, orders := range priceLevels {
		if len(orders) >= mad.layeringThreshold {
			totalVolume := 0.0
			minTime := time.Now()
			maxTime := time.Time{}
			
			for _, order := range orders {
				totalVolume += order.Volume
				if order.Timestamp.Before(minTime) {
					minTime = order.Timestamp
				}
				if order.Timestamp.After(maxTime) {
					maxTime = order.Timestamp
				}
			}
			
			if totalVolume*price >= mad.spoofingThreshold {
				confidence := math.Min(1.0, float64(len(orders))/10.0)
				
				patterns = append(patterns, MicrostructurePattern{
					PatternType:  "LAYERING",
					Confidence:   confidence,
					Severity:     mad.calculateSeverity(confidence),
					PriceImpact:  0.0,
					VolumeImpact: totalVolume,
					Duration:     maxTime.Sub(minTime),
					StartTime:    minTime,
					EndTime:      maxTime,
					Description:  fmt.Sprintf("%d orders layered at $%.2f (Total: $%.0f)", len(orders), price, totalVolume*price),
				})
			}
		}
	}
	
	return patterns
}

// detectIcebergPatterns detects iceberg order patterns
func (mad *MicrostructureAnomalyDetector) detectIcebergPatterns() []MicrostructurePattern {
	var patterns []MicrostructurePattern
	
	// Calculate average order size
	if len(mad.recentOrderFlow) < 10 {
		return patterns
	}
	
	totalVolume := 0.0
	for _, event := range mad.recentOrderFlow {
		totalVolume += event.Volume
	}
	avgOrderSize := totalVolume / float64(len(mad.recentOrderFlow))
	
	// Look for repeated small orders at similar prices (iceberg fragments)
	priceGroups := make(map[float64][]OrderFlowEvent)
	
	for _, event := range mad.recentOrderFlow {
		if event.Volume < avgOrderSize*mad.icebergThreshold {
			roundedPrice := math.Round(event.Price*10) / 10 // Group by $0.10
			priceGroups[roundedPrice] = append(priceGroups[roundedPrice], event)
		}
	}
	
	// Identify potential icebergs
	for price, orders := range priceGroups {
		if len(orders) >= 5 { // At least 5 small orders
			totalVolume := 0.0
			for _, order := range orders {
				totalVolume += order.Volume
			}
			
			if totalVolume >= avgOrderSize*3 { // Total volume is significant
				confidence := math.Min(1.0, float64(len(orders))/20.0)
				
				patterns = append(patterns, MicrostructurePattern{
					PatternType:  "ICEBERG",
					Confidence:   confidence,
					Severity:     mad.calculateSeverity(confidence),
					PriceImpact:  0.0,
					VolumeImpact: totalVolume,
					Duration:     orders[len(orders)-1].Timestamp.Sub(orders[0].Timestamp),
					StartTime:    orders[0].Timestamp,
					EndTime:      orders[len(orders)-1].Timestamp,
					Description:  fmt.Sprintf("Iceberg pattern: %d small orders (%.4f avg) at ~$%.1f", len(orders), totalVolume/float64(len(orders)), price),
				})
			}
		}
	}
	
	return patterns
}

// detectMomentumIgnitionPatterns detects momentum ignition patterns
func (mad *MicrostructureAnomalyDetector) detectMomentumIgnitionPatterns() []MicrostructurePattern {
	var patterns []MicrostructurePattern
	
	if len(mad.recentOrderFlow) < 20 {
		return patterns
	}
	
	// Look for sudden price movements followed by increased activity
	recentEvents := mad.recentOrderFlow[len(mad.recentOrderFlow)-20:]
	
	// Calculate price movement
	startPrice := recentEvents[0].Price
	endPrice := recentEvents[len(recentEvents)-1].Price
	priceChange := math.Abs(endPrice-startPrice) / startPrice
	
	if priceChange >= mad.momentumThreshold {
		// Check for increased activity
		firstHalf := recentEvents[:len(recentEvents)/2]
		secondHalf := recentEvents[len(recentEvents)/2:]
		
		firstHalfVolume := 0.0
		secondHalfVolume := 0.0
		
		for _, event := range firstHalf {
			firstHalfVolume += event.Volume
		}
		for _, event := range secondHalf {
			secondHalfVolume += event.Volume
		}
		
		if secondHalfVolume > firstHalfVolume*1.5 { // 50% increase in activity
			confidence := math.Min(1.0, priceChange/mad.momentumThreshold)
			
			patterns = append(patterns, MicrostructurePattern{
				PatternType:  "MOMENTUM_IGNITION",
				Confidence:   confidence,
				Severity:     mad.calculateSeverity(confidence),
				PriceImpact:  priceChange,
				VolumeImpact: secondHalfVolume,
				Duration:     recentEvents[len(recentEvents)-1].Timestamp.Sub(recentEvents[0].Timestamp),
				StartTime:    recentEvents[0].Timestamp,
				EndTime:      recentEvents[len(recentEvents)-1].Timestamp,
				Description:  fmt.Sprintf("Momentum ignition: %.2f%% price move with %.1fx volume increase", priceChange*100, secondHalfVolume/firstHalfVolume),
			})
		}
	}
	
	return patterns
}

// detectStructuralBreaks detects structural market breaks
func (mad *MicrostructureAnomalyDetector) detectStructuralBreaks() []StructuralBreak {
	var breaks []StructuralBreak
	
	// Detect liquidity shocks
	liquidityBreaks := mad.detectLiquidityShocks()
	breaks = append(breaks, liquidityBreaks...)
	
	// Detect volatility spikes
	volatilityBreaks := mad.detectVolatilitySpikes()
	breaks = append(breaks, volatilityBreaks...)
	
	// Detect regime changes
	regimeBreaks := mad.detectRegimeChanges()
	breaks = append(breaks, regimeBreaks...)
	
	return breaks
}

// detectLiquidityShocks detects sudden liquidity changes
func (mad *MicrostructureAnomalyDetector) detectLiquidityShocks() []StructuralBreak {
	var breaks []StructuralBreak
	
	if mad.baselineMetrics["liquidity"] == 0 {
		return breaks
	}
	
	// Check for significant liquidity change
	liquidityChange := math.Abs(mad.currentLiquidity-mad.baselineMetrics["liquidity"]) / mad.baselineMetrics["liquidity"]
	
	if liquidityChange >= 0.5 { // 50% change in liquidity
		confidence := math.Min(1.0, liquidityChange/0.5)
		
		impact := "TEMPORARY"
		if liquidityChange >= 1.0 {
			impact = "PERSISTENT"
		}
		
		breaks = append(breaks, StructuralBreak{
			BreakType:      "LIQUIDITY_SHOCK",
			BreakLevel:     mad.currentLiquidity,
			Magnitude:      liquidityChange,
			Confidence:     confidence,
			PreBreakState:  fmt.Sprintf("Liquidity: %.0f", mad.baselineMetrics["liquidity"]),
			PostBreakState: fmt.Sprintf("Liquidity: %.0f", mad.currentLiquidity),
			Timestamp:      time.Now(),
			Impact:         impact,
		})
	}
	
	return breaks
}

// detectVolatilitySpikes detects sudden volatility changes
func (mad *MicrostructureAnomalyDetector) detectVolatilitySpikes() []StructuralBreak {
	var breaks []StructuralBreak
	
	if mad.baselineMetrics["volatility"] == 0 {
		return breaks
	}
	
	// Check for significant volatility change
	volatilityRatio := mad.currentVolatility / mad.baselineMetrics["volatility"]
	
	if volatilityRatio >= 2.0 { // 2x increase in volatility
		confidence := math.Min(1.0, volatilityRatio/2.0)
		
		breaks = append(breaks, StructuralBreak{
			BreakType:      "VOLATILITY_SPIKE",
			BreakLevel:     mad.currentVolatility,
			Magnitude:      volatilityRatio,
			Confidence:     confidence,
			PreBreakState:  fmt.Sprintf("Volatility: %.4f", mad.baselineMetrics["volatility"]),
			PostBreakState: fmt.Sprintf("Volatility: %.4f", mad.currentVolatility),
			Timestamp:      time.Now(),
			Impact:         "TEMPORARY",
		})
	}
	
	return breaks
}

// detectRegimeChanges detects market regime changes
func (mad *MicrostructureAnomalyDetector) detectRegimeChanges() []StructuralBreak {
	var breaks []StructuralBreak
	
	// This would require more sophisticated analysis
	// For now, we'll detect based on combined metrics
	
	if mad.baselineMetrics["liquidity"] == 0 || mad.baselineMetrics["volatility"] == 0 {
		return breaks
	}
	
	liquidityChange := math.Abs(mad.currentLiquidity-mad.baselineMetrics["liquidity"]) / mad.baselineMetrics["liquidity"]
	volatilityChange := mad.currentVolatility / mad.baselineMetrics["volatility"]
	
	// Regime change if both liquidity and volatility change significantly
	if liquidityChange >= 0.3 && volatilityChange >= 1.5 {
		confidence := math.Min(1.0, (liquidityChange+volatilityChange)/2.0)
		
		breaks = append(breaks, StructuralBreak{
			BreakType:      "REGIME_CHANGE",
			BreakLevel:     0.0, // Not applicable for regime changes
			Magnitude:      (liquidityChange + volatilityChange) / 2.0,
			Confidence:     confidence,
			PreBreakState:  "Normal market conditions",
			PostBreakState: "Altered market structure",
			Timestamp:      time.Now(),
			Impact:         "STRUCTURAL",
		})
	}
	
	return breaks
}

// calculateSeverity calculates pattern severity from confidence
func (mad *MicrostructureAnomalyDetector) calculateSeverity(confidence float64) string {
	if confidence >= 0.8 {
		return "CRITICAL"
	} else if confidence >= 0.6 {
		return "HIGH"
	} else if confidence >= 0.4 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// updateActivePatterns updates the list of active patterns
func (mad *MicrostructureAnomalyDetector) updateActivePatterns(newPatterns []MicrostructurePattern) {
	// Add new patterns
	mad.activePatterns = append(mad.activePatterns, newPatterns...)
	
	// Remove old patterns (older than 5 minutes)
	cutoff := time.Now().Add(-5 * time.Minute)
	validPatterns := make([]MicrostructurePattern, 0)
	
	for _, pattern := range mad.activePatterns {
		if pattern.EndTime.After(cutoff) {
			validPatterns = append(validPatterns, pattern)
		}
	}
	mad.activePatterns = validPatterns
	
	// Limit memory usage
	if len(mad.activePatterns) > mad.maxPatterns {
		mad.activePatterns = mad.activePatterns[len(mad.activePatterns)-mad.maxPatterns:]
	}
}

// updateRecentBreaks updates the list of recent structural breaks
func (mad *MicrostructureAnomalyDetector) updateRecentBreaks(newBreaks []StructuralBreak) {
	// Add new breaks
	mad.recentBreaks = append(mad.recentBreaks, newBreaks...)
	
	// Remove old breaks (older than 15 minutes)
	cutoff := time.Now().Add(-15 * time.Minute)
	validBreaks := make([]StructuralBreak, 0)
	
	for _, breakEvent := range mad.recentBreaks {
		if breakEvent.Timestamp.After(cutoff) {
			validBreaks = append(validBreaks, breakEvent)
		}
	}
	mad.recentBreaks = validBreaks
	
	// Limit memory usage
	if len(mad.recentBreaks) > mad.maxBreaks {
		mad.recentBreaks = mad.recentBreaks[len(mad.recentBreaks)-mad.maxBreaks:]
	}
}

// generateAnomalyAlert generates comprehensive anomaly alert
func (mad *MicrostructureAnomalyDetector) generateAnomalyAlert() *MicrostructureAnomalyAlert {
	if len(mad.activePatterns) == 0 && len(mad.recentBreaks) == 0 {
		return nil
	}
	
	// Calculate anomaly score
	anomalyScore := mad.calculateAnomalyScore()
	
	// Determine risk level
	riskLevel := mad.determineRiskLevel(anomalyScore)
	
	// Determine recommended action
	recommendedAction := mad.determineRecommendedAction(riskLevel, anomalyScore)
	
	// Assess market quality
	marketQuality := mad.assessMarketQuality(anomalyScore)
	
	return &MicrostructureAnomalyAlert{
		Symbol:            mad.symbol,
		Patterns:          mad.activePatterns,
		StructuralBreaks:  mad.recentBreaks,
		AnomalyScore:      anomalyScore,
		RiskLevel:         riskLevel,
		RecommendedAction: recommendedAction,
		MarketQuality:     marketQuality,
		Timestamp:         time.Now(),
	}
}

// calculateAnomalyScore calculates overall anomaly score
func (mad *MicrostructureAnomalyDetector) calculateAnomalyScore() float64 {
	score := 0.0
	
	// Score from patterns
	for _, pattern := range mad.activePatterns {
		weight := 1.0
		switch pattern.Severity {
		case "CRITICAL":
			weight = 4.0
		case "HIGH":
			weight = 3.0
		case "MEDIUM":
			weight = 2.0
		case "LOW":
			weight = 1.0
		}
		score += pattern.Confidence * weight
	}
	
	// Score from structural breaks
	for _, breakEvent := range mad.recentBreaks {
		weight := 2.0
		if breakEvent.Impact == "STRUCTURAL" {
			weight = 4.0
		} else if breakEvent.Impact == "PERSISTENT" {
			weight = 3.0
		}
		score += breakEvent.Confidence * weight
	}
	
	// Normalize score
	maxPossibleScore := float64(len(mad.activePatterns)*4 + len(mad.recentBreaks)*4)
	if maxPossibleScore > 0 {
		score = score / maxPossibleScore
	}
	
	return math.Min(score, 1.0)
}

// determineRiskLevel determines risk level from anomaly score
func (mad *MicrostructureAnomalyDetector) determineRiskLevel(anomalyScore float64) string {
	if anomalyScore >= 0.8 {
		return "CRITICAL"
	} else if anomalyScore >= 0.6 {
		return "HIGH"
	} else if anomalyScore >= 0.4 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// determineRecommendedAction determines recommended action
func (mad *MicrostructureAnomalyDetector) determineRecommendedAction(riskLevel string, anomalyScore float64) string {
	switch riskLevel {
	case "CRITICAL":
		return "HALT_TRADING"
	case "HIGH":
		return "REDUCE_SIZE"
	default:
		return "MONITOR"
	}
}

// assessMarketQuality assesses current market quality
func (mad *MicrostructureAnomalyDetector) assessMarketQuality(anomalyScore float64) string {
	if anomalyScore >= 0.7 {
		return "DISRUPTED"
	} else if anomalyScore >= 0.4 {
		return "DEGRADED"
	} else {
		return "NORMAL"
	}
}

// publishAnomalyAlert publishes anomaly alert to Redis
func (mad *MicrostructureAnomalyDetector) publishAnomalyAlert(alert *MicrostructureAnomalyAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal anomaly alert: %w", err)
	}
	
	channel := fmt.Sprintf("%s:microstructure_anomaly", mad.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = mad.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish anomaly alert: %w", err)
	}
	
	log.Printf("🚨 Microstructure Anomaly: %s | %s | Score: %.3f | Patterns: %d | Breaks: %d | Quality: %s",
		alert.Symbol, alert.RiskLevel, alert.AnomalyScore, len(alert.Patterns), len(alert.StructuralBreaks), alert.MarketQuality)
	
	return nil
}

// Start begins the real microstructure anomaly detection process
func (mad *MicrostructureAnomalyDetector) Start(ctx context.Context) error {
	log.Printf("🔍 Starting Microstructure Anomaly Detector for %s", mad.symbol)
	
	// Subscribe to real order flow events
	channel := fmt.Sprintf("%s:order_flow", mad.symbol)
	pubsub := mad.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := mad.ProcessOrderFlow([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Microstructure anomaly processing error for %s: %v", mad.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the microstructure anomaly detector
func (mad *MicrostructureAnomalyDetector) Stop() error {
	log.Printf("🛑 Stopping Microstructure Anomaly Detector for %s", mad.symbol)
	return nil
}

// Health returns the health status
func (mad *MicrostructureAnomalyDetector) Health() bool {
	mad.mu.RLock()
	defer mad.mu.RUnlock()
	
	// Check if we have recent order flow data
	if len(mad.recentOrderFlow) == 0 {
		return true // No data is normal
	}
	
	// Check if latest order flow is recent (within last 5 minutes)
	latestEvent := mad.recentOrderFlow[len(mad.recentOrderFlow)-1]
	return time.Since(latestEvent.Timestamp) < 5*time.Minute
}

// Name returns the service name
func (mad *MicrostructureAnomalyDetector) Name() string {
	return fmt.Sprintf("MicrostructureAnomalyDetector-%s", mad.symbol)
} 