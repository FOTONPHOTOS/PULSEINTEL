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

// VPINBucket represents a volume bucket for VPIN calculation
type VPINBucket struct {
	BucketID       int       `json:"bucket_id"`
	TargetVolume   float64   `json:"target_volume"`
	AccumulatedVol float64   `json:"accumulated_volume"`
	BuyVolume      float64   `json:"buy_volume"`
	SellVolume     float64   `json:"sell_volume"`
	OrderImbalance float64   `json:"order_imbalance"` // |Buy - Sell| / Total
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	IsComplete     bool      `json:"is_complete"`
	TradeCount     int       `json:"trade_count"`
}

// VPINMetrics represents comprehensive VPIN analysis metrics
type VPINMetrics struct {
	Symbol                string        `json:"symbol"`
	CurrentVPIN           float64       `json:"current_vpin"`        // Current VPIN value
	VPINPercentile        float64       `json:"vpin_percentile"`    // Historical percentile
	InformedTradingProb   float64       `json:"informed_trading_prob"` // Probability of informed trading
	ToxicityLevel         string        `json:"toxicity_level"`     // "LOW", "MEDIUM", "HIGH", "EXTREME"
	OrderFlowToxicity     float64       `json:"order_flow_toxicity"` // 0.0-1.0
	RecentBuckets         []VPINBucket  `json:"recent_buckets"`
	BucketSize            float64       `json:"bucket_size"`        // Volume per bucket
	CompletedBuckets      int           `json:"completed_buckets"`
	AvgBucketTime         time.Duration `json:"avg_bucket_time"`
	MarketMicrostructure  string        `json:"market_microstructure"` // "NORMAL", "STRESSED", "TOXIC"
	InformedTradeSignal   string        `json:"informed_trade_signal"` // "BUY", "SELL", "NEUTRAL"
	Confidence            float64       `json:"confidence"`         // Signal confidence
	Timestamp             time.Time     `json:"timestamp"`
}

// VPINAlert represents VPIN-based trading alerts
type VPINAlert struct {
	Symbol              string      `json:"symbol"`
	AlertType           string      `json:"alert_type"`      // "HIGH_VPIN", "TOXIC_FLOW", "INFORMED_ACTIVITY"
	VPINValue           float64     `json:"vpin_value"`
	ToxicityScore       float64     `json:"toxicity_score"`
	InformedDirection   string      `json:"informed_direction"` // Direction of informed trading
	MarketImpact        string      `json:"market_impact"`   // "MINIMAL", "MODERATE", "SEVERE"
	RecommendedAction   string      `json:"recommended_action"` // "AVOID", "REDUCE_SIZE", "WAIT", "FOLLOW"
	RiskAssessment      string      `json:"risk_assessment"` // "LOW", "MEDIUM", "HIGH", "EXTREME"
	ExpectedDuration    time.Duration `json:"expected_duration"` // How long condition may last
	Timestamp           time.Time   `json:"timestamp"`
}

// VPINTradeData represents individual trade data for VPIN calculation
type VPINTradeData struct {
	Price      float64   `json:"price"`
	Volume     float64   `json:"volume"`
	Side       string    `json:"side"`       // "BUY", "SELL", or classified
	Timestamp  time.Time `json:"timestamp"`
	IsAggressor bool     `json:"is_aggressor"` // True if market order
}

// VPINAnalyzer calculates real VPIN metrics from order flow
type VPINAnalyzer struct {
	redisClient    *redis.Client
	symbol         string
	
	// VPIN calculation parameters
	numBuckets       int           // Number of buckets for VPIN calculation
	bucketSize       float64       // Volume per bucket
	currentBucket    *VPINBucket   // Currently filling bucket
	completedBuckets []VPINBucket  // Recently completed buckets
	maxBucketHistory int           // Maximum buckets to keep
	
	// Historical VPIN data for percentile calculation
	historicalVPIN   []float64
	maxHistoricalData int
	
	// Trade classification parameters
	tickSize         float64       // Minimum price increment
	classificationWindow time.Duration // Window for trade classification
	
	// Analysis thresholds
	highVPINThreshold    float64   // Threshold for high VPIN alert
	toxicityThreshold    float64   // Threshold for toxicity alert
	informedThreshold    float64   // Threshold for informed trading
	
	// Real-time metrics
	recentTrades     []VPINTradeData
	maxTradeHistory  int
	
	mu               sync.RWMutex
	lastAnalysis     time.Time
	analysisInterval time.Duration
}

// NewVPINAnalyzer creates a new real VPIN analyzer
func NewVPINAnalyzer(redisClient *redis.Client, symbol string) *VPINAnalyzer {
	// Calculate dynamic bucket size based on symbol (simplified)
	bucketSize := 10000.0 // Base volume per bucket
	if symbol == "btcusdt" {
		bucketSize = 50000.0 // Higher volume for BTC
	}
	
	return &VPINAnalyzer{
		redisClient:          redisClient,
		symbol:               symbol,
		numBuckets:           50,        // Use 50 buckets for VPIN calculation
		bucketSize:           bucketSize,
		maxBucketHistory:     200,       // Keep 200 completed buckets
		maxHistoricalData:    1000,      // Keep 1000 historical VPIN values
		tickSize:             0.01,      // Default tick size
		classificationWindow: 100 * time.Millisecond,
		highVPINThreshold:    0.3,       // 30% threshold for high VPIN
		toxicityThreshold:    0.4,       // 40% threshold for toxicity
		informedThreshold:    0.25,      // 25% threshold for informed trading
		maxTradeHistory:      1000,
		analysisInterval:     5 * time.Second,
		completedBuckets:     make([]VPINBucket, 0, 200),
		historicalVPIN:       make([]float64, 0, 1000),
		recentTrades:         make([]VPINTradeData, 0, 1000),
	}
}

// ProcessTrade processes real trade data for VPIN calculation
func (vpa *VPINAnalyzer) ProcessTrade(tradeData []byte) error {
	vpa.mu.Lock()
	defer vpa.mu.Unlock()
	
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
	if trade.Symbol != vpa.symbol || trade.Price <= 0 || trade.Volume <= 0 {
		return fmt.Errorf("invalid trade data: symbol=%s, price=%f, volume=%f", 
			trade.Symbol, trade.Price, trade.Volume)
	}
	
	// Classify trade if side is not provided
	if trade.Side == "" {
		trade.Side = vpa.classifyTrade(trade.Price, trade.Timestamp)
	}
	
	// Create trade data
	tradeEntry := VPINTradeData{
		Price:       trade.Price,
		Volume:      trade.Volume,
		Side:        trade.Side,
		Timestamp:   trade.Timestamp,
		IsAggressor: true, // Assume market orders for simplicity
	}
	
	// Add to recent trades
	vpa.recentTrades = append(vpa.recentTrades, tradeEntry)
	
	// Clean old trades
	vpa.cleanOldTrades()
	
	// Process trade for VPIN buckets
	vpa.processTradeToBucket(tradeEntry)
	
	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(vpa.lastAnalysis) >= vpa.analysisInterval {
		metrics := vpa.calculateVPINMetrics()
		if metrics != nil {
			vpa.publishVPINMetrics(metrics)
			
			// Generate alerts if necessary
			alert := vpa.generateVPINAlert(metrics)
			if alert != nil {
				vpa.publishVPINAlert(alert)
			}
		}
		vpa.lastAnalysis = now
	}
	
	return nil
}

// classifyTrade classifies trade as buy or sell using tick rule
func (vpa *VPINAnalyzer) classifyTrade(price float64, timestamp time.Time) string {
	// Simple tick rule: compare with recent trade prices
	if len(vpa.recentTrades) == 0 {
		return "NEUTRAL"
	}
	
	// Find recent trades within classification window
	cutoff := timestamp.Add(-vpa.classificationWindow)
	recentPrices := make([]float64, 0)
	
	for i := len(vpa.recentTrades) - 1; i >= 0; i-- {
		trade := vpa.recentTrades[i]
		if trade.Timestamp.Before(cutoff) {
			break
		}
		recentPrices = append(recentPrices, trade.Price)
	}
	
	if len(recentPrices) == 0 {
		return "NEUTRAL"
	}
	
	// Use tick rule: if price > recent average, it's a buy
	avgPrice := 0.0
	for _, p := range recentPrices {
		avgPrice += p
	}
	avgPrice /= float64(len(recentPrices))
	
	if price > avgPrice+vpa.tickSize/2 {
		return "BUY"
	} else if price < avgPrice-vpa.tickSize/2 {
		return "SELL"
	} else {
		return "NEUTRAL"
	}
}

// cleanOldTrades removes old trades to manage memory
func (vpa *VPINAnalyzer) cleanOldTrades() {
	if len(vpa.recentTrades) <= vpa.maxTradeHistory {
		return
	}
	
	// Keep only the most recent trades
	vpa.recentTrades = vpa.recentTrades[len(vpa.recentTrades)-vpa.maxTradeHistory:]
}

// processTradeToBucket adds trade to current VPIN bucket
func (vpa *VPINAnalyzer) processTradeToBucket(trade VPINTradeData) {
	// Initialize current bucket if needed
	if vpa.currentBucket == nil {
		vpa.currentBucket = &VPINBucket{
			BucketID:     len(vpa.completedBuckets) + 1,
			TargetVolume: vpa.bucketSize,
			StartTime:    trade.Timestamp,
		}
	}
	
	// Add trade to current bucket
	vpa.currentBucket.AccumulatedVol += trade.Volume
	vpa.currentBucket.TradeCount++
	vpa.currentBucket.EndTime = trade.Timestamp
	
	// Classify volume by side
	switch trade.Side {
	case "BUY":
		vpa.currentBucket.BuyVolume += trade.Volume
	case "SELL":
		vpa.currentBucket.SellVolume += trade.Volume
	default:
		// Distribute neutral trades evenly
		vpa.currentBucket.BuyVolume += trade.Volume / 2
		vpa.currentBucket.SellVolume += trade.Volume / 2
	}
	
	// Check if bucket is complete
	if vpa.currentBucket.AccumulatedVol >= vpa.currentBucket.TargetVolume {
		vpa.completeBucket()
	}
}

// completeBucket completes current bucket and starts new one
func (vpa *VPINAnalyzer) completeBucket() {
	if vpa.currentBucket == nil {
		return
	}
	
	// Calculate order imbalance
	totalVolume := vpa.currentBucket.BuyVolume + vpa.currentBucket.SellVolume
	if totalVolume > 0 {
		imbalance := math.Abs(vpa.currentBucket.BuyVolume - vpa.currentBucket.SellVolume)
		vpa.currentBucket.OrderImbalance = imbalance / totalVolume
	}
	
	vpa.currentBucket.IsComplete = true
	
	// Add to completed buckets
	vpa.completedBuckets = append(vpa.completedBuckets, *vpa.currentBucket)
	
	// Limit bucket history
	if len(vpa.completedBuckets) > vpa.maxBucketHistory {
		vpa.completedBuckets = vpa.completedBuckets[1:]
	}
	
	// Reset current bucket
	vpa.currentBucket = nil
}

// calculateVPINMetrics calculates comprehensive VPIN metrics
func (vpa *VPINAnalyzer) calculateVPINMetrics() *VPINMetrics {
	if len(vpa.completedBuckets) < vpa.numBuckets {
		return nil // Need minimum buckets for VPIN calculation
	}
	
	// Get recent buckets for VPIN calculation
	recentBuckets := vpa.completedBuckets
	if len(recentBuckets) > vpa.numBuckets {
		recentBuckets = recentBuckets[len(recentBuckets)-vpa.numBuckets:]
	}
	
	// Calculate VPIN
	totalImbalance := 0.0
	totalVolume := 0.0
	totalBucketTime := time.Duration(0)
	
	for _, bucket := range recentBuckets {
		totalImbalance += bucket.OrderImbalance * bucket.AccumulatedVol
		totalVolume += bucket.AccumulatedVol
		if !bucket.StartTime.IsZero() && !bucket.EndTime.IsZero() {
			totalBucketTime += bucket.EndTime.Sub(bucket.StartTime)
		}
	}
	
	currentVPIN := 0.0
	if totalVolume > 0 {
		currentVPIN = totalImbalance / totalVolume
	}
	
	// Add to historical VPIN data
	if currentVPIN > 0 {
		vpa.historicalVPIN = append(vpa.historicalVPIN, currentVPIN)
		if len(vpa.historicalVPIN) > vpa.maxHistoricalData {
			vpa.historicalVPIN = vpa.historicalVPIN[1:]
		}
	}
	
	// Calculate VPIN percentile
	vpinPercentile := vpa.calculateVPINPercentile(currentVPIN)
	
	// Calculate informed trading probability
	informedTradingProb := vpa.calculateInformedTradingProbability(currentVPIN)
	
	// Determine toxicity level
	toxicityLevel := vpa.determineToxicityLevel(currentVPIN)
	
	// Calculate order flow toxicity
	orderFlowToxicity := math.Min(currentVPIN*2.5, 1.0) // Scale VPIN to toxicity
	
	// Determine market microstructure state
	microstructureState := vpa.determineMarketMicrostructure(currentVPIN, vpinPercentile)
	
	// Generate informed trade signal
	signal, confidence := vpa.generateInformedTradeSignal(recentBuckets)
	
	// Calculate average bucket time
	avgBucketTime := time.Duration(0)
	if len(recentBuckets) > 0 {
		avgBucketTime = totalBucketTime / time.Duration(len(recentBuckets))
	}
	
	return &VPINMetrics{
		Symbol:               vpa.symbol,
		CurrentVPIN:          currentVPIN,
		VPINPercentile:       vpinPercentile,
		InformedTradingProb:  informedTradingProb,
		ToxicityLevel:        toxicityLevel,
		OrderFlowToxicity:    orderFlowToxicity,
		RecentBuckets:        recentBuckets,
		BucketSize:           vpa.bucketSize,
		CompletedBuckets:     len(vpa.completedBuckets),
		AvgBucketTime:        avgBucketTime,
		MarketMicrostructure: microstructureState,
		InformedTradeSignal:  signal,
		Confidence:           confidence,
		Timestamp:            time.Now(),
	}
}

// calculateVPINPercentile calculates current VPIN percentile
func (vpa *VPINAnalyzer) calculateVPINPercentile(currentVPIN float64) float64 {
	if len(vpa.historicalVPIN) < 10 {
		return 0.5 // Default to 50th percentile
	}
	
	// Sort historical VPIN values
	sortedVPIN := make([]float64, len(vpa.historicalVPIN))
	copy(sortedVPIN, vpa.historicalVPIN)
	sort.Float64s(sortedVPIN)
	
	// Find percentile
	count := 0
	for _, vpin := range sortedVPIN {
		if vpin <= currentVPIN {
			count++
		}
	}
	
	return float64(count) / float64(len(sortedVPIN))
}

// calculateInformedTradingProbability calculates probability of informed trading
func (vpa *VPINAnalyzer) calculateInformedTradingProbability(vpin float64) float64 {
	// VPIN directly represents probability of informed trading
	// Apply sigmoid transformation for better scaling
	return 1.0 / (1.0 + math.Exp(-10*(vpin-0.5)))
}

// determineToxicityLevel determines toxicity level from VPIN
func (vpa *VPINAnalyzer) determineToxicityLevel(vpin float64) string {
	if vpin >= 0.5 {
		return "EXTREME"
	} else if vpin >= vpa.toxicityThreshold {
		return "HIGH"
	} else if vpin >= vpa.highVPINThreshold {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// determineMarketMicrostructure determines market microstructure state
func (vpa *VPINAnalyzer) determineMarketMicrostructure(vpin, percentile float64) string {
	if vpin >= 0.4 || percentile >= 0.9 {
		return "TOXIC"
	} else if vpin >= 0.25 || percentile >= 0.75 {
		return "STRESSED"
	} else {
		return "NORMAL"
	}
}

// generateInformedTradeSignal generates signal based on recent bucket analysis
func (vpa *VPINAnalyzer) generateInformedTradeSignal(buckets []VPINBucket) (string, float64) {
	if len(buckets) < 5 {
		return "NEUTRAL", 0.0
	}
	
	// Analyze recent bucket imbalances
	recentBuckets := buckets[len(buckets)-5:] // Last 5 buckets
	buyBias := 0.0
	sellBias := 0.0
	totalWeight := 0.0
	
	for _, bucket := range recentBuckets {
		if bucket.BuyVolume > bucket.SellVolume {
			buyBias += bucket.OrderImbalance * bucket.AccumulatedVol
		} else {
			sellBias += bucket.OrderImbalance * bucket.AccumulatedVol
		}
		totalWeight += bucket.AccumulatedVol
	}
	
	if totalWeight == 0 {
		return "NEUTRAL", 0.0
	}
	
	buyBias /= totalWeight
	sellBias /= totalWeight
	
	// Determine signal
	if buyBias > sellBias && buyBias > vpa.informedThreshold {
		return "BUY", buyBias
	} else if sellBias > buyBias && sellBias > vpa.informedThreshold {
		return "SELL", sellBias
	} else {
		return "NEUTRAL", 0.0
	}
}

// generateVPINAlert generates VPIN-based alerts
func (vpa *VPINAnalyzer) generateVPINAlert(metrics *VPINMetrics) *VPINAlert {
	// Only generate alerts for significant conditions
	if metrics.CurrentVPIN < vpa.highVPINThreshold && 
		 metrics.ToxicityLevel == "LOW" && 
		 metrics.InformedTradingProb < 0.7 {
		return nil
	}
	
	// Determine alert type
	alertType := "HIGH_VPIN"
	if metrics.ToxicityLevel == "HIGH" || metrics.ToxicityLevel == "EXTREME" {
		alertType = "TOXIC_FLOW"
	}
	if metrics.InformedTradingProb > 0.8 {
		alertType = "INFORMED_ACTIVITY"
	}
	
	// Determine informed direction
	informedDirection := metrics.InformedTradeSignal
	if informedDirection == "NEUTRAL" {
		informedDirection = "UNKNOWN"
	}
	
	// Assess market impact
	marketImpact := vpa.assessMarketImpact(metrics)
	
	// Determine recommended action
	recommendedAction := vpa.determineRecommendedAction(metrics)
	
	// Assess risk
	riskAssessment := vpa.assessRisk(metrics)
	
	// Estimate duration
	expectedDuration := vpa.estimateConditionDuration(metrics)
	
	return &VPINAlert{
		Symbol:            vpa.symbol,
		AlertType:         alertType,
		VPINValue:         metrics.CurrentVPIN,
		ToxicityScore:     metrics.OrderFlowToxicity,
		InformedDirection: informedDirection,
		MarketImpact:      marketImpact,
		RecommendedAction: recommendedAction,
		RiskAssessment:    riskAssessment,
		ExpectedDuration:  expectedDuration,
		Timestamp:         time.Now(),
	}
}

// assessMarketImpact assesses potential market impact
func (vpa *VPINAnalyzer) assessMarketImpact(metrics *VPINMetrics) string {
	if metrics.CurrentVPIN >= 0.5 {
		return "SEVERE"
	} else if metrics.CurrentVPIN >= 0.35 {
		return "MODERATE"
	} else {
		return "MINIMAL"
	}
}

// determineRecommendedAction determines recommended trading action
func (vpa *VPINAnalyzer) determineRecommendedAction(metrics *VPINMetrics) string {
	if metrics.ToxicityLevel == "EXTREME" {
		return "AVOID"
	} else if metrics.ToxicityLevel == "HIGH" {
		return "REDUCE_SIZE"
	} else if metrics.InformedTradingProb > 0.8 && metrics.InformedTradeSignal != "NEUTRAL" {
		return "FOLLOW"
	} else {
		return "WAIT"
	}
}

// assessRisk assesses overall risk level
func (vpa *VPINAnalyzer) assessRisk(metrics *VPINMetrics) string {
	riskScore := metrics.CurrentVPIN + metrics.OrderFlowToxicity + metrics.InformedTradingProb
	riskScore /= 3.0 // Average
	
	if riskScore >= 0.75 {
		return "EXTREME"
	} else if riskScore >= 0.5 {
		return "HIGH"
	} else if riskScore >= 0.3 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// estimateConditionDuration estimates how long current condition may last
func (vpa *VPINAnalyzer) estimateConditionDuration(metrics *VPINMetrics) time.Duration {
	// Base duration on average bucket time and VPIN level
	baseDuration := metrics.AvgBucketTime * time.Duration(vpa.numBuckets/4)
	
	// Adjust based on VPIN level
	multiplier := 1.0 + metrics.CurrentVPIN*2.0
	
	return time.Duration(float64(baseDuration) * multiplier)
}

// publishVPINMetrics publishes VPIN metrics to Redis
func (vpa *VPINAnalyzer) publishVPINMetrics(metrics *VPINMetrics) error {
	data, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal VPIN metrics: %w", err)
	}
	
	channel := fmt.Sprintf("%s:vpin", vpa.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = vpa.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish VPIN metrics: %w", err)
	}
	
	log.Printf("📊 VPIN: %s | VPIN: %.4f | Toxicity: %s | Informed: %.3f | Signal: %s",
		metrics.Symbol, metrics.CurrentVPIN, metrics.ToxicityLevel, 
		metrics.InformedTradingProb, metrics.InformedTradeSignal)
	
	return nil
}

// publishVPINAlert publishes VPIN alert to Redis
func (vpa *VPINAnalyzer) publishVPINAlert(alert *VPINAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal VPIN alert: %w", err)
	}
	
	channel := fmt.Sprintf("%s:vpin_alert", vpa.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = vpa.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish VPIN alert: %w", err)
	}
	
	log.Printf("🚨 VPIN Alert: %s | %s | VPIN: %.4f | Risk: %s | Action: %s",
		alert.Symbol, alert.AlertType, alert.VPINValue, 
		alert.RiskAssessment, alert.RecommendedAction)
	
	return nil
}

// Start begins the real VPIN analysis process
func (vpa *VPINAnalyzer) Start(ctx context.Context) error {
	log.Printf("📊 Starting VPIN Analyzer for %s", vpa.symbol)
	
	// Subscribe to real trade events
	channel := fmt.Sprintf("%s:trade", vpa.symbol)
	pubsub := vpa.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := vpa.ProcessTrade([]byte(msg.Payload)); err != nil {
				log.Printf("❌ VPIN processing error for %s: %v", vpa.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the VPIN analyzer
func (vpa *VPINAnalyzer) Stop() error {
	log.Printf("🛑 Stopping VPIN Analyzer for %s", vpa.symbol)
	return nil
}

// Health returns the health status
func (vpa *VPINAnalyzer) Health() bool {
	vpa.mu.RLock()
	defer vpa.mu.RUnlock()
	
	// Check if we have recent trades
	if len(vpa.recentTrades) == 0 {
		return true // No trades is normal
	}
	
	// Check if latest trade is recent (within last 2 minutes)
	latestTrade := vpa.recentTrades[len(vpa.recentTrades)-1]
	return time.Since(latestTrade.Timestamp) < 2*time.Minute
}

// Name returns the service name
func (vpa *VPINAnalyzer) Name() string {
	return fmt.Sprintf("VPINAnalyzer-%s", vpa.symbol)
} 