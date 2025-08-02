package detectors

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"p9_microstream/internal/analytics"
)

// Trade represents a real trade event for VWAP calculation
type Trade struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Volume    float64   `json:"volume"`
	Value     float64   `json:"value"` // Price * Volume
	Side      string    `json:"side"`
	Timestamp time.Time `json:"timestamp"`
}

// VWAPData represents VWAP calculation data
type VWAPData struct {
	VWAP          float64   `json:"vwap"`
	TotalValue    float64   `json:"total_value"`
	TotalVolume   float64   `json:"total_volume"`
	TradeCount    int       `json:"trade_count"`
	StartTime     time.Time `json:"start_time"`
	LastUpdate    time.Time `json:"last_update"`
	Window        string    `json:"window"` // "1m", "5m", "15m"
}

// MeanReversionSignal represents a mean reversion signal
type MeanReversionSignal struct {
	Symbol        string    `json:"symbol"`
	CurrentPrice  float64   `json:"current_price"`
	VWAP1m        float64   `json:"vwap_1m"`
	VWAP5m        float64   `json:"vwap_5m"`
	VWAP15m       float64   `json:"vwap_15m"`
	ZScore1m      float64   `json:"zscore_1m"`
	ZScore5m      float64   `json:"zscore_5m"`
	ZScore15m     float64   `json:"zscore_15m"`
	Signal        string    `json:"signal"`        // BUY, SELL, NEUTRAL
	Confidence    float64   `json:"confidence"`    // 0.0-1.0
	Strength      string    `json:"strength"`      // WEAK, MODERATE, STRONG, EXTREME
	Reasoning     string    `json:"reasoning"`
	Timestamp     time.Time `json:"timestamp"`
}

// StatisticalData represents statistical analysis data
type StatisticalData struct {
	Prices        []float64 `json:"prices"`
	Mean          float64   `json:"mean"`
	StdDev        float64   `json:"std_dev"`
	Variance      float64   `json:"variance"`
	LastUpdate    time.Time `json:"last_update"`
	SampleSize    int       `json:"sample_size"`
}

// MeanReversionTracker processes real trade data and generates mean reversion signals
type MeanReversionTracker struct {
	redisClient    *redis.Client
	symbol         string
	
	// Multi-timeframe VWAP tracking
	vwap1m         *VWAPData
	vwap5m         *VWAPData
	vwap15m        *VWAPData
	
	// Statistical analysis data
	stats1m        *StatisticalData
	stats5m        *StatisticalData
	stats15m       *StatisticalData
	
	// Real trade storage
	trades1m       []Trade
	trades5m       []Trade
	trades15m      []Trade
	
	// Analysis parameters
	zscoreThreshold float64   // Z-score threshold for signal generation
	minTrades       int       // Minimum trades for valid analysis
	maxTrades       int       // Maximum trades to keep in memory
	
	// Time windows
	window1m        time.Duration
	window5m        time.Duration
	window15m       time.Duration
	
	mu              sync.RWMutex
	lastAnalysis    time.Time
	analysisInterval time.Duration
}

// NewMeanReversionTracker creates a new real mean reversion tracker
func NewMeanReversionTracker(redisClient *redis.Client, symbol string) *MeanReversionTracker {
	return &MeanReversionTracker{
		redisClient:      redisClient,
		symbol:           symbol,
		zscoreThreshold:  2.0, // 2 standard deviations
		minTrades:        10,  // Minimum trades for analysis
		maxTrades:        1000, // Maximum trades to keep
		window1m:         1 * time.Minute,
		window5m:         5 * time.Minute,
		window15m:        15 * time.Minute,
		analysisInterval: 5 * time.Second,
		
		// Initialize VWAP data
		vwap1m:  &VWAPData{Window: "1m"},
		vwap5m:  &VWAPData{Window: "5m"},
		vwap15m: &VWAPData{Window: "15m"},
		
		// Initialize statistical data
		stats1m: &StatisticalData{Prices: make([]float64, 0, 1000)},
		stats5m: &StatisticalData{Prices: make([]float64, 0, 1000)},
		stats15m: &StatisticalData{Prices: make([]float64, 0, 1000)},
		
		// Initialize trade storage
		trades1m:  make([]Trade, 0, 1000),
		trades5m:  make([]Trade, 0, 1000),
		trades15m: make([]Trade, 0, 1000),
	}
}

// ProcessTrade processes a real trade event for mean reversion analysis
func (mrt *MeanReversionTracker) ProcessTrade(tradeData []byte) error {
	mrt.mu.Lock()
	defer mrt.mu.Unlock()
	
	// Parse real trade data using unified parsing system
	standardTrade, err := analytics.ParseBinanceTradeData(string(tradeData))
	if err != nil {
		return fmt.Errorf("failed to parse trade: %w", err)
	}
	
	// Convert to internal Trade format
	trade := Trade{
		Symbol:    standardTrade.Symbol,
		Price:     standardTrade.Price,
		Volume:    standardTrade.Quantity, // Volume = Quantity in our context
		Value:     standardTrade.Value,
		Side:      standardTrade.Side,
		Timestamp: standardTrade.Timestamp,
	}
	
	// Validate real data
	if trade.Symbol != mrt.symbol || trade.Price <= 0 || trade.Volume <= 0 {
		return fmt.Errorf("invalid trade data: symbol=%s, price=%f, volume=%f", 
			trade.Symbol, trade.Price, trade.Volume)
	}
	
	// Add to all timeframes
	mrt.addTradeToTimeframe(&mrt.trades1m, trade, mrt.window1m)
	mrt.addTradeToTimeframe(&mrt.trades5m, trade, mrt.window5m)
	mrt.addTradeToTimeframe(&mrt.trades15m, trade, mrt.window15m)
	
	// Update VWAP calculations
	mrt.updateVWAP(mrt.vwap1m, mrt.trades1m)
	mrt.updateVWAP(mrt.vwap5m, mrt.trades5m)
	mrt.updateVWAP(mrt.vwap15m, mrt.trades15m)
	
	// Update statistical data
	mrt.updateStatistics(mrt.stats1m, mrt.trades1m)
	mrt.updateStatistics(mrt.stats5m, mrt.trades5m)
	mrt.updateStatistics(mrt.stats15m, mrt.trades15m)
	
	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(mrt.lastAnalysis) >= mrt.analysisInterval {
		signal := mrt.generateRealMeanReversionSignal(trade.Price)
		if signal != nil {
			mrt.publishSignal(signal)
		}
		mrt.lastAnalysis = now
	}
	
	return nil
}

// addTradeToTimeframe adds a trade to the specified timeframe and cleans old data
func (mrt *MeanReversionTracker) addTradeToTimeframe(trades *[]Trade, trade Trade, window time.Duration) {
	// Add new trade
	*trades = append(*trades, trade)
	
	// Remove trades outside the time window
	cutoff := trade.Timestamp.Add(-window)
	validTrades := make([]Trade, 0, len(*trades))
	
	for _, t := range *trades {
		if t.Timestamp.After(cutoff) {
			validTrades = append(validTrades, t)
		}
	}
	
	*trades = validTrades
	
	// Limit memory usage
	if len(*trades) > mrt.maxTrades {
		*trades = (*trades)[len(*trades)-mrt.maxTrades:]
	}
}

// updateVWAP updates VWAP calculation with real trade data
func (mrt *MeanReversionTracker) updateVWAP(vwapData *VWAPData, trades []Trade) {
	if len(trades) == 0 {
		return
	}
	
	// Calculate VWAP from all trades in the window
	totalValue := 0.0
	totalVolume := 0.0
	
	for _, trade := range trades {
		totalValue += trade.Value
		totalVolume += trade.Volume
	}
	
	// Update VWAP data
	if totalVolume > 0 {
		vwapData.VWAP = totalValue / totalVolume
		vwapData.TotalValue = totalValue
		vwapData.TotalVolume = totalVolume
		vwapData.TradeCount = len(trades)
		vwapData.LastUpdate = time.Now()
		
		// Set start time if first calculation
		if vwapData.StartTime.IsZero() && len(trades) > 0 {
			vwapData.StartTime = trades[0].Timestamp
		}
	}
}

// updateStatistics updates statistical analysis data
func (mrt *MeanReversionTracker) updateStatistics(stats *StatisticalData, trades []Trade) {
	if len(trades) < mrt.minTrades {
		return
	}
	
	// Extract prices for statistical analysis
	prices := make([]float64, len(trades))
	for i, trade := range trades {
		prices[i] = trade.Price
	}
	
	// Calculate mean
	sum := 0.0
	for _, price := range prices {
		sum += price
	}
	mean := sum / float64(len(prices))
	
	// Calculate variance and standard deviation
	variance := 0.0
	for _, price := range prices {
		diff := price - mean
		variance += diff * diff
	}
	variance /= float64(len(prices))
	stdDev := math.Sqrt(variance)
	
	// Update statistics
	stats.Prices = prices
	stats.Mean = mean
	stats.StdDev = stdDev
	stats.Variance = variance
	stats.SampleSize = len(prices)
	stats.LastUpdate = time.Now()
}

// generateRealMeanReversionSignal generates mean reversion signals from real data
func (mrt *MeanReversionTracker) generateRealMeanReversionSignal(currentPrice float64) *MeanReversionSignal {
	// Check if we have enough data for analysis
	if len(mrt.trades1m) < mrt.minTrades {
		return nil
	}
	
	// Calculate Z-scores for all timeframes
	zscore1m := mrt.calculateZScore(currentPrice, mrt.stats1m)
	zscore5m := mrt.calculateZScore(currentPrice, mrt.stats5m)
	zscore15m := mrt.calculateZScore(currentPrice, mrt.stats15m)
	
	// Determine signal based on Z-scores
	signal, confidence, strength := mrt.analyzeZScores(zscore1m, zscore5m, zscore15m)
	
	// Generate reasoning
	reasoning := mrt.generateReasoning(currentPrice, zscore1m, zscore5m, zscore15m, signal)
	
	return &MeanReversionSignal{
		Symbol:       mrt.symbol,
		CurrentPrice: currentPrice,
		VWAP1m:       mrt.vwap1m.VWAP,
		VWAP5m:       mrt.vwap5m.VWAP,
		VWAP15m:      mrt.vwap15m.VWAP,
		ZScore1m:     zscore1m,
		ZScore5m:     zscore5m,
		ZScore15m:    zscore15m,
		Signal:       signal,
		Confidence:   confidence,
		Strength:     strength,
		Reasoning:    reasoning,
		Timestamp:    time.Now(),
	}
}

// calculateZScore calculates Z-score for mean reversion analysis
func (mrt *MeanReversionTracker) calculateZScore(currentPrice float64, stats *StatisticalData) float64 {
	if stats.StdDev == 0 || stats.SampleSize < mrt.minTrades {
		return 0.0
	}
	
	// Z-score = (current_price - mean) / standard_deviation
	return (currentPrice - stats.Mean) / stats.StdDev
}

// analyzeZScores analyzes Z-scores across timeframes to generate signals
func (mrt *MeanReversionTracker) analyzeZScores(zscore1m, zscore5m, zscore15m float64) (string, float64, string) {
	// Count significant Z-scores
	significantScores := 0
	totalAbsScore := 0.0
	
	if math.Abs(zscore1m) >= mrt.zscoreThreshold {
		significantScores++
		totalAbsScore += math.Abs(zscore1m)
	}
	
	if math.Abs(zscore5m) >= mrt.zscoreThreshold {
		significantScores++
		totalAbsScore += math.Abs(zscore5m)
	}
	
	if math.Abs(zscore15m) >= mrt.zscoreThreshold {
		significantScores++
		totalAbsScore += math.Abs(zscore15m)
	}
	
	// No significant deviation
	if significantScores == 0 {
		return "NEUTRAL", 0.0, "WEAK"
	}
	
	// Determine signal direction
	avgZScore := (zscore1m + zscore5m + zscore15m) / 3.0
	var signal string
	
	if avgZScore > mrt.zscoreThreshold {
		signal = "SELL" // Price too high, expect reversion down
	} else if avgZScore < -mrt.zscoreThreshold {
		signal = "BUY"  // Price too low, expect reversion up
	} else {
		signal = "NEUTRAL"
	}
	
	// Calculate confidence based on timeframe agreement
	confidence := float64(significantScores) / 3.0
	
	// Adjust confidence by Z-score magnitude
	avgAbsScore := totalAbsScore / float64(significantScores)
	if avgAbsScore > 3.0 {
		confidence = math.Min(confidence*1.5, 1.0)
	}
	
	// Determine strength
	strength := mrt.determineSignalStrength(avgAbsScore, significantScores)
	
	return signal, confidence, strength
}

// determineSignalStrength determines signal strength from Z-score analysis
func (mrt *MeanReversionTracker) determineSignalStrength(avgAbsScore float64, significantScores int) string {
	if avgAbsScore >= 4.0 && significantScores >= 2 {
		return "EXTREME"
	} else if avgAbsScore >= 3.0 && significantScores >= 2 {
		return "STRONG"
	} else if avgAbsScore >= 2.5 || significantScores >= 2 {
		return "MODERATE"
	} else {
		return "WEAK"
	}
}

// generateReasoning generates human-readable reasoning for the signal
func (mrt *MeanReversionTracker) generateReasoning(currentPrice, zscore1m, zscore5m, zscore15m float64, signal string) string {
	switch signal {
	case "BUY":
		return fmt.Sprintf("Price $%.2f significantly below VWAP (Z-scores: 1m=%.2f, 5m=%.2f, 15m=%.2f). Mean reversion suggests upward correction.",
			currentPrice, zscore1m, zscore5m, zscore15m)
	case "SELL":
		return fmt.Sprintf("Price $%.2f significantly above VWAP (Z-scores: 1m=%.2f, 5m=%.2f, 15m=%.2f). Mean reversion suggests downward correction.",
			currentPrice, zscore1m, zscore5m, zscore15m)
	default:
		return fmt.Sprintf("Price $%.2f near VWAP levels (Z-scores: 1m=%.2f, 5m=%.2f, 15m=%.2f). No significant deviation detected.",
			currentPrice, zscore1m, zscore5m, zscore15m)
	}
}

// publishSignal publishes mean reversion signal to Redis
func (mrt *MeanReversionTracker) publishSignal(signal *MeanReversionSignal) error {
	data, err := json.Marshal(signal)
	if err != nil {
		return fmt.Errorf("failed to marshal mean reversion signal: %w", err)
	}
	
	channel := fmt.Sprintf("%s:mean_reversion", mrt.symbol)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = mrt.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish mean reversion signal: %w", err)
	}
	
	log.Printf("🔄 Mean Reversion: %s | %s | Price: $%.2f | VWAP: $%.2f | Z-Score: %.2f | Conf: %.3f",
		signal.Symbol, signal.Signal, signal.CurrentPrice, signal.VWAP1m, signal.ZScore1m, signal.Confidence)
	
	return nil
}

// Start begins the real mean reversion tracking process
func (mrt *MeanReversionTracker) Start(ctx context.Context) error {
	log.Printf("🔄 Starting Mean Reversion Tracker for %s", mrt.symbol)
	
	// Subscribe to real trade events
	channel := fmt.Sprintf("%s:trade", mrt.symbol)
	pubsub := mrt.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := mrt.ProcessTrade([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Mean reversion processing error for %s: %v", mrt.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the mean reversion tracker
func (mrt *MeanReversionTracker) Stop() error {
	log.Printf("🛑 Stopping Mean Reversion Tracker for %s", mrt.symbol)
	return nil
}

// Health returns the health status
func (mrt *MeanReversionTracker) Health() bool {
	mrt.mu.RLock()
	defer mrt.mu.RUnlock()
	
	// Check if we have recent data
	if len(mrt.trades1m) == 0 {
		return true // No trades is normal
	}
	
	// Check if latest trade is recent (within last 5 minutes)
	latestTrade := mrt.trades1m[len(mrt.trades1m)-1]
	return time.Since(latestTrade.Timestamp) < 5*time.Minute
}

// Name returns the service name
func (mrt *MeanReversionTracker) Name() string {
	return fmt.Sprintf("MeanReversionTracker-%s", mrt.symbol)
}

// GetVWAPData returns current VWAP data for external use
func (mrt *MeanReversionTracker) GetVWAPData() map[string]*VWAPData {
	mrt.mu.RLock()
	defer mrt.mu.RUnlock()
	
	return map[string]*VWAPData{
		"1m":  mrt.vwap1m,
		"5m":  mrt.vwap5m,
		"15m": mrt.vwap15m,
	}
}

// GetStatistics returns current statistical data for external use
func (mrt *MeanReversionTracker) GetStatistics() map[string]*StatisticalData {
	mrt.mu.RLock()
	defer mrt.mu.RUnlock()
	
	return map[string]*StatisticalData{
		"1m":  mrt.stats1m,
		"5m":  mrt.stats5m,
		"15m": mrt.stats15m,
	}
} 