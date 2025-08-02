package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	// Internal modules
	"pulseintel/internal/config"
	"pulseintel/internal/events"
)

// ============================================================================
// HISTORICAL-REALTIME FUSION ENGINE - PRECISION9 INTEGRATION
// ============================================================================

type HistoricalRealtimeFusion struct {
	redisClient       *redis.Client
	historicalFetcher *HistoricalDataFetcher
	mtfCoordinator    *MultiTimeframeCoordinator

	cfg *config.Config // loaded application config

	// Market Context Database
	marketContext map[string]*MarketStructureContext // [exchange:symbol] -> context
	mutex         sync.RWMutex

	// Fusion Status
	symbolStatus map[string]*FusionStatus // [exchange:symbol] -> status
	statusMutex  sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc

	// Performance Metrics
	fusionComplete   int64
	contextUpdates   int64
	realtimeIngested int64
	startTime        time.Time

	// NEW: throttle context publishing
	lastPublish     map[string]time.Time // exchange:symbol -> last publish time
	publishInterval time.Duration        // minimum gap between publishes
}

// MarketStructureContext holds comprehensive market context for a symbol
type MarketStructureContext struct {
	Exchange   string    `json:"exchange"`
	Symbol     string    `json:"symbol"`
	LastUpdate time.Time `json:"last_update"`

	// Historical Candle Data (1000 periods per timeframe)
	HistoricalCandles map[string][]events.OHLCVCandle `json:"historical_candles"` // [timeframe] -> candles

	// Market Structure Levels
	KeyLevels      []PriceLevel    `json:"key_levels"`
	VolumeProfile  []VolumeNode    `json:"volume_profile"`
	LiquidityZones []LiquidityZone `json:"liquidity_zones"`

	// Statistical Context
	VolatilityMetrics map[string]float64   `json:"volatility_metrics"` // [timeframe] -> volatility
	VolumeMetrics     map[string]float64   `json:"volume_metrics"`     // [timeframe] -> avg_volume
	TrendMetrics      map[string]TrendInfo `json:"trend_metrics"`      // [timeframe] -> trend

	// Real-time Integration
	CurrentCandles  map[string]*events.OHLCVCandle `json:"current_candles"` // [timeframe] -> active candle
	RealtimeMetrics RealtimeMetrics                `json:"realtime_metrics"`

	// Fusion Quality
	DataCompleteness float64   `json:"data_completeness"`
	LastFusionUpdate time.Time `json:"last_fusion_update"`

	mutex sync.RWMutex
}

// FusionStatus tracks the status of historical-realtime fusion
type FusionStatus struct {
	Exchange           string          `json:"exchange"`
	Symbol             string          `json:"symbol"`
	HistoricalComplete bool            `json:"historical_complete"`
	RealtimeActive     bool            `json:"realtime_active"`
	TimeframesReady    map[string]bool `json:"timeframes_ready"`
	LastHistoricalSync time.Time       `json:"last_historical_sync"`
	LastRealtimeUpdate time.Time       `json:"last_realtime_update"`
	TotalCandles       int             `json:"total_candles"`
	QualityScore       float64         `json:"quality_score"`

	mutex sync.RWMutex
}

// PriceLevel represents key price levels in market structure
type PriceLevel struct {
	Price      float64   `json:"price"`
	Type       string    `json:"type"`     // "support", "resistance", "pivot"
	Strength   float64   `json:"strength"` // 0.0-1.0
	TouchCount int       `json:"touch_count"`
	LastTouch  time.Time `json:"last_touch"`
}

// VolumeNode represents volume at price levels
type VolumeNode struct {
	Price  float64 `json:"price"`
	Volume float64 `json:"volume"`
	Count  int     `json:"count"`
}

// LiquidityZone represents areas of high liquidity concentration
type LiquidityZone struct {
	PriceHigh float64 `json:"price_high"`
	PriceLow  float64 `json:"price_low"`
	Volume    float64 `json:"volume"`
	Density   float64 `json:"density"`
	Type      string  `json:"type"` // "accumulation", "distribution", "neutral"
}

// TrendInfo represents trend analysis for timeframe
type TrendInfo struct {
	Direction  string  `json:"direction"`  // "up", "down", "sideways"
	Strength   float64 `json:"strength"`   // 0.0-1.0
	Duration   int     `json:"duration"`   // periods
	Confidence float64 `json:"confidence"` // 0.0-1.0
}

// RealtimeMetrics holds real-time market metrics
type RealtimeMetrics struct {
	CurrentPrice       float64   `json:"current_price"`
	PriceChange24h     float64   `json:"price_change_24h"`
	VolumeChange24h    float64   `json:"volume_change_24h"`
	LastTradeTime      time.Time `json:"last_trade_time"`
	TradesPerMinute    float64   `json:"trades_per_minute"`
	AvgTradeSize       float64   `json:"avg_trade_size"`
	BidAskSpread       float64   `json:"bid_ask_spread"`
	MarketDepth        float64   `json:"market_depth"`
	VolatilityRealtime float64   `json:"volatility_realtime"`
}

// NewHistoricalRealtimeFusion creates a new fusion engine
func NewHistoricalRealtimeFusion(redisClient *redis.Client, cfg *config.Config, orderBookAnalyzer *MultiTimeframeCoordinator) *HistoricalRealtimeFusion {
	ctx, cancel := context.WithCancel(context.Background())

	fusion := &HistoricalRealtimeFusion{
		redisClient:       redisClient,
		historicalFetcher: NewHistoricalDataFetcher(redisClient),
		mtfCoordinator:    orderBookAnalyzer,
		cfg:               cfg,
		marketContext:     make(map[string]*MarketStructureContext),
		symbolStatus:      make(map[string]*FusionStatus),
		ctx:               ctx,
		cancel:            cancel,
		startTime:         time.Now(),

		lastPublish:     make(map[string]time.Time),
		publishInterval: 200 * time.Millisecond, // max 5 snapshots / sec
	}

	// Start monitoring and reporting
	go fusion.monitoringLoop()

	log.Println("🔄 Historical-Realtime Fusion Engine initialized")
	log.Println("📊 Ready to fuse 1000 historical candles with real-time streams")

	return fusion
}

// InitializeMarketContext initializes market context for all symbols
func (f *HistoricalRealtimeFusion) InitializeMarketContext() error {
	log.Println("🚀 Starting Market Context Initialization...")

	// Build exchanges -> symbols map from configuration
	exchanges := make([]string, 0)
	symbols := make(map[string][]string)

	for _, ex := range f.cfg.Exchanges {
		if !ex.Enabled {
			continue
		}

		exName := strings.ToLower(ex.Name)
		exchanges = append(exchanges, exName)

		// Use normalized symbols for consistency
		var list []string
		for _, sym := range ex.Symbols {
			list = append(list, NormalizeSymbol(sym))
		}
		symbols[exName] = list
	}

	if len(exchanges) == 0 {
		return fmt.Errorf("no enabled exchanges found in configuration")
	}

	// Target timeframes: 1d to 1m as requested
	timeframes := []string{"1d", "12h", "6h", "4h", "2h", "1h", "30m", "15m", "5m", "3m", "1m"}

	log.Printf("📈 Fetching historical data for %d exchanges, %d timeframes", len(exchanges), len(timeframes))

	for _, exchange := range exchanges {
		for _, symbol := range symbols[exchange] {
			key := fmt.Sprintf("%s:%s", exchange, symbol)
			log.Printf("[CONTEXT-INIT] Storing market context under key: %s", key)

			// Create market context
			context := &MarketStructureContext{
				Exchange:          exchange,
				Symbol:            symbol,
				LastUpdate:        time.Now(),
				HistoricalCandles: make(map[string][]events.OHLCVCandle),
				VolatilityMetrics: make(map[string]float64),
				VolumeMetrics:     make(map[string]float64),
				TrendMetrics:      make(map[string]TrendInfo),
				CurrentCandles:    make(map[string]*events.OHLCVCandle),
				KeyLevels:         []PriceLevel{},
				VolumeProfile:     []VolumeNode{},
				LiquidityZones:    []LiquidityZone{},
			}

			// Create fusion status
			status := &FusionStatus{
				Exchange:        exchange,
				Symbol:          symbol,
				TimeframesReady: make(map[string]bool),
			}

			// Store in maps
			f.mutex.Lock()
			f.marketContext[key] = context
			f.mutex.Unlock()

			f.statusMutex.Lock()
			f.symbolStatus[key] = status
			f.statusMutex.Unlock()

			// Fetch historical data for all timeframes
			err := f.fetchHistoricalDataForSymbol(exchange, symbol, timeframes)
			if err != nil {
				log.Printf("❌ Failed to fetch historical data for %s: %v", key, err)
				continue
			}

			// Calculate market structure
			f.calculateMarketStructure(context)

			// Mark as ready
			status.mutex.Lock()
			status.HistoricalComplete = true
			status.LastHistoricalSync = time.Now()
			status.QualityScore = f.calculateQualityScore(context)
			status.mutex.Unlock()

			log.Printf("✅ %s market context initialized (Quality: %.2f)", key, status.QualityScore)

			// Small delay to respect rate limits
			time.Sleep(200 * time.Millisecond)
		}
	}

	log.Println("🎯 Market Context Initialization Complete")
	f.publishFusionStatus()

	// 🚀 CRITICAL FIX: Publish initial market context for all symbols
	// This ensures bots receive historical data immediately instead of waiting for live trades
	log.Println("📡 Publishing initial market contexts to Redis...")
	f.publishInitialMarketContexts()

	return nil
}

// fetchHistoricalDataForSymbol fetches 1000 candles for each timeframe
func (f *HistoricalRealtimeFusion) fetchHistoricalDataForSymbol(exchange, symbol string, timeframes []string) error {
	key := fmt.Sprintf("%s:%s", exchange, symbol)

	for _, timeframe := range timeframes {
		log.Printf("📊 Fetching %s %s 1000x %s candles...", exchange, symbol, timeframe)

		candles, err := f.fetchHistoricalCandles(exchange, symbol, timeframe, 1000)
		if err != nil {
			log.Printf("⚠️ Failed to fetch %s %s %s: %v", exchange, symbol, timeframe, err)
			continue
		}

		// Store in market context
		f.mutex.Lock()
		if context := f.marketContext[key]; context != nil {
			context.mutex.Lock()
			context.HistoricalCandles[timeframe] = candles
			context.mutex.Unlock()
		}
		f.mutex.Unlock()

		// Update status
		f.statusMutex.Lock()
		if status := f.symbolStatus[key]; status != nil {
			status.mutex.Lock()
			status.TimeframesReady[timeframe] = true
			status.TotalCandles += len(candles)
			status.mutex.Unlock()
		}
		f.statusMutex.Unlock()

		log.Printf("✅ Stored %d %s candles for %s %s", len(candles), timeframe, exchange, symbol)

		// Respect rate limits
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}

// fetchHistoricalCandles fetches historical candles from Redis storage (not external APIs)
func (f *HistoricalRealtimeFusion) fetchHistoricalCandles(exchange, symbol, timeframe string, limit int) ([]events.OHLCVCandle, error) {
	// Use Redis candle aggregator to get processed historical candles
	aggregator := NewRedisCandleAggregator(f.redisClient)

	// Get candles from Redis storage
	candles, err := aggregator.GetHistoricalCandles(exchange, symbol, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get Redis candles for %s %s: %w", symbol, timeframe, err)
	}

	// Convert to events.OHLCVCandle format
	var eventCandles []events.OHLCVCandle
	for _, candle := range candles {
		eventCandle := events.OHLCVCandle{
			OpenTime:   candle.OpenTime,
			CloseTime:  candle.CloseTime,
			Open:       candle.Open,
			High:       candle.High,
			Low:        candle.Low,
			Close:      candle.Close,
			Volume:     candle.Volume,
			TradeCount: int64(candle.TradeCount),
			Symbol:     symbol,
			Exchange:   exchange,
			Timeframe:  timeframe,
		}
		eventCandles = append(eventCandles, eventCandle)
	}

	// Apply limit if requested
	if limit > 0 && len(eventCandles) > limit {
		eventCandles = eventCandles[len(eventCandles)-limit:]
	}

	log.Printf("📊 Retrieved %d %s candles for %s:%s from Redis storage",
		len(eventCandles), timeframe, exchange, symbol)

	return eventCandles, nil
}

// calculateMarketStructure analyzes historical data to identify key market structure
func (f *HistoricalRealtimeFusion) calculateMarketStructure(context *MarketStructureContext) {
	context.mutex.Lock()
	defer context.mutex.Unlock()

	// Calculate for each timeframe
	for timeframe, candles := range context.HistoricalCandles {
		if len(candles) == 0 {
			continue
		}

		// Sort candles by timestamp
		sort.Slice(candles, func(i, j int) bool {
			return candles[i].OpenTime.Before(candles[j].OpenTime)
		})

		// Calculate volatility metrics
		context.VolatilityMetrics[timeframe] = f.calculateVolatility(candles)

		// Calculate volume metrics
		context.VolumeMetrics[timeframe] = f.calculateAverageVolume(candles)

		// Calculate trend metrics
		context.TrendMetrics[timeframe] = f.calculateTrend(candles)

		// Identify key levels (for daily timeframe)
		if timeframe == "1d" {
			context.KeyLevels = f.identifyKeyLevels(candles)
			context.VolumeProfile = f.buildVolumeProfile(candles)
			context.LiquidityZones = f.identifyLiquidityZones(candles)
		}
	}

	// Calculate overall data completeness
	totalTimeframes := 11 // 1d to 1m
	completedTimeframes := len(context.HistoricalCandles)
	context.DataCompleteness = float64(completedTimeframes) / float64(totalTimeframes)
	context.LastFusionUpdate = time.Now()

	log.Printf("📊 Market structure calculated for %s:%s (%.1f%% complete)",
		context.Exchange, context.Symbol, context.DataCompleteness*100)
}

// ProcessRealtimeTrade processes real-time trade and updates context
func (f *HistoricalRealtimeFusion) ProcessRealtimeTrade(trade *events.Trade) {
	key := fmt.Sprintf("%s:%s", trade.Exchange, trade.Symbol)

	// Update market context
	f.mutex.Lock()
	context := f.marketContext[key]
	f.mutex.Unlock()

	if context == nil {
		log.Printf("⚠️ No market context for %s", key)
		return
	}

	// Update real-time metrics
	context.mutex.Lock()
	context.RealtimeMetrics.CurrentPrice = trade.Price
	context.RealtimeMetrics.LastTradeTime = trade.Timestamp
	context.RealtimeMetrics.AvgTradeSize = (context.RealtimeMetrics.AvgTradeSize + trade.Value) / 2
	context.mutex.Unlock()

	// Process through MTF coordinator
	f.mtfCoordinator.ProcessTrade(trade)

	// Update status
	f.statusMutex.Lock()
	if status := f.symbolStatus[key]; status != nil {
		status.mutex.Lock()
		status.RealtimeActive = true
		status.LastRealtimeUpdate = time.Now()
		status.mutex.Unlock()
	}
	f.statusMutex.Unlock()

	f.realtimeIngested++

	// Publish fused context to Redis for Precision9
	f.publishMarketContext(key, context)
}

// publishMarketContext publishes complete market context to Redis
func (f *HistoricalRealtimeFusion) publishMarketContext(key string, context *MarketStructureContext) {
	// RETENTION: Trim HistoricalCandles to keep payload size reasonable
	for tf, candles := range context.HistoricalCandles {
		limit := retentionLimit(tf)
		if len(candles) > limit {
			context.HistoricalCandles[tf] = candles[len(candles)-limit:]
		}
	}

	// THROTTLE: only publish if interval elapsed
	now := time.Now()
	if last, ok := f.lastPublish[key]; ok && now.Sub(last) < f.publishInterval {
		return // skip publish, too soon
	}
	f.lastPublish[key] = now

	context.mutex.RLock()
	defer context.mutex.RUnlock()

	// Create comprehensive market context payload
	payload := map[string]interface{}{
		"exchange":           context.Exchange,
		"symbol":             context.Symbol,
		"timestamp":          time.Now().Unix(),
		"historical_data":    context.HistoricalCandles,
		"key_levels":         context.KeyLevels,
		"volume_profile":     context.VolumeProfile,
		"liquidity_zones":    context.LiquidityZones,
		"volatility_metrics": context.VolatilityMetrics,
		"volume_metrics":     context.VolumeMetrics,
		"trend_metrics":      context.TrendMetrics,
		"realtime_metrics":   context.RealtimeMetrics,
		"data_completeness":  context.DataCompleteness,
		"fusion_type":        "historical_realtime_fusion",
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		log.Printf("❌ Failed to marshal context for %s: %v", key, err)
		return
	}

	// Publish to a single channel – downstream consumers derive others if needed
	channels := []string{
		fmt.Sprintf("market_context:%s", strings.ToLower(key)),
	}

	for _, channel := range channels {
		err := f.redisClient.Publish(f.ctx, channel, payloadJSON).Err()
		if err != nil {
			log.Printf("❌ Failed to publish to %s: %v", channel, err)
		}
	}

	// Store the latest full context in Redis (30-second TTL) for on-demand retrieval
	cacheKey := fmt.Sprintf("market_context_full:%s", strings.ToLower(key))
	_ = f.redisClient.Set(f.ctx, cacheKey, payloadJSON, 30*time.Second).Err()
}

// publishInitialMarketContexts publishes all initialized market contexts to Redis
// This is called once after initialization to provide historical data to connecting bots
func (f *HistoricalRealtimeFusion) publishInitialMarketContexts() {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	published := 0
	for key, context := range f.marketContext {
		if context != nil && context.DataCompleteness > 0.5 { // Only publish contexts with >50% data
			log.Printf("📡 Publishing initial context for %s (%.1f%% complete)", key, context.DataCompleteness*100)

			// Temporarily bypass throttling for initial publish
			f.lastPublish[key] = time.Time{} // Reset last publish time

			f.publishMarketContext(key, context)
			published++

			// Small delay between publications
			time.Sleep(100 * time.Millisecond)
		}
	}

	log.Printf("✅ Published %d initial market contexts to Redis", published)
}

// retentionLimit returns the maximum number of candles to keep for a timeframe
func retentionLimit(tf string) int {
	switch tf {
	case "1s", "5s", "15s", "30s":
		return 1000
	case "1m", "3m", "5m":
		return 500
	case "15m", "30m", "1h":
		return 300
	case "2h", "4h", "6h", "12h":
		return 200
	case "1d":
		return 120
	default:
		return 200
	}
}

// Helper functions for market structure analysis
func (f *HistoricalRealtimeFusion) calculateVolatility(candles []events.OHLCVCandle) float64 {
	if len(candles) < 2 {
		return 0.0
	}

	var returns []float64
	for i := 1; i < len(candles); i++ {
		if candles[i-1].Close > 0 {
			ret := (candles[i].Close - candles[i-1].Close) / candles[i-1].Close
			returns = append(returns, ret)
		}
	}

	if len(returns) == 0 {
		return 0.0
	}

	// Calculate standard deviation
	var sum, mean float64
	for _, ret := range returns {
		sum += ret
	}
	mean = sum / float64(len(returns))

	var variance float64
	for _, ret := range returns {
		variance += (ret - mean) * (ret - mean)
	}

	return variance / float64(len(returns))
}

func (f *HistoricalRealtimeFusion) calculateAverageVolume(candles []events.OHLCVCandle) float64 {
	if len(candles) == 0 {
		return 0.0
	}

	var totalVolume float64
	for _, candle := range candles {
		totalVolume += candle.Volume
	}

	return totalVolume / float64(len(candles))
}

func (f *HistoricalRealtimeFusion) calculateTrend(candles []events.OHLCVCandle) TrendInfo {
	if len(candles) < 10 {
		return TrendInfo{Direction: "insufficient_data", Strength: 0.0, Confidence: 0.0}
	}

	// Adaptive trend calculation based on available candles
	totalLen := len(candles)

	// Use half the candles for recent, half for older (minimum 5 each)
	recentSize := max(5, totalLen/4)
	olderSize := max(5, totalLen/4)

	// Ensure we don't go out of bounds
	if recentSize*2 > totalLen {
		recentSize = totalLen / 2
		olderSize = totalLen / 2
	}

	recent := candles[totalLen-recentSize:]
	older := candles[totalLen-recentSize-olderSize : totalLen-recentSize]

	var recentAvg, olderAvg float64
	for _, candle := range recent {
		recentAvg += candle.Close
	}
	recentAvg /= float64(len(recent))

	for _, candle := range older {
		olderAvg += candle.Close
	}
	olderAvg /= float64(len(older))

	change := (recentAvg - olderAvg) / olderAvg

	var direction string
	var strength float64

	if change > 0.02 {
		direction = "up"
		strength = change * 10
	} else if change < -0.02 {
		direction = "down"
		strength = -change * 10
	} else {
		direction = "sideways"
		strength = 0.5
	}

	if strength > 1.0 {
		strength = 1.0
	}

	return TrendInfo{
		Direction:  direction,
		Strength:   strength,
		Duration:   len(recent),
		Confidence: strength,
	}
}

func (f *HistoricalRealtimeFusion) identifyKeyLevels(candles []events.OHLCVCandle) []PriceLevel {
	// Simplified key level identification
	levels := []PriceLevel{}

	if len(candles) < 50 {
		return levels
	}

	// Find significant highs and lows
	for i := 10; i < len(candles)-10; i++ {
		candle := candles[i]

		// Check if it's a local high
		isHigh := true
		for j := i - 5; j <= i+5; j++ {
			if j != i && candles[j].High > candle.High {
				isHigh = false
				break
			}
		}

		if isHigh {
			levels = append(levels, PriceLevel{
				Price:      candle.High,
				Type:       "resistance",
				Strength:   0.7,
				TouchCount: 1,
				LastTouch:  candle.OpenTime,
			})
		}

		// Check if it's a local low
		isLow := true
		for j := i - 5; j <= i+5; j++ {
			if j != i && candles[j].Low < candle.Low {
				isLow = false
				break
			}
		}

		if isLow {
			levels = append(levels, PriceLevel{
				Price:      candle.Low,
				Type:       "support",
				Strength:   0.7,
				TouchCount: 1,
				LastTouch:  candle.OpenTime,
			})
		}
	}

	return levels
}

func (f *HistoricalRealtimeFusion) buildVolumeProfile(candles []events.OHLCVCandle) []VolumeNode {
	profile := []VolumeNode{}

	if len(candles) == 0 {
		return profile
	}

	// Create price buckets
	minPrice := candles[0].Low
	maxPrice := candles[0].High

	for _, candle := range candles {
		if candle.Low < minPrice {
			minPrice = candle.Low
		}
		if candle.High > maxPrice {
			maxPrice = candle.High
		}
	}

	buckets := 50
	priceStep := (maxPrice - minPrice) / float64(buckets)
	volumeMap := make(map[int]float64)

	for _, candle := range candles {
		bucket := int((candle.Close - minPrice) / priceStep)
		if bucket >= buckets {
			bucket = buckets - 1
		}
		volumeMap[bucket] += candle.Volume
	}

	for bucket, volume := range volumeMap {
		price := minPrice + float64(bucket)*priceStep
		profile = append(profile, VolumeNode{
			Price:  price,
			Volume: volume,
			Count:  1,
		})
	}

	return profile
}

func (f *HistoricalRealtimeFusion) identifyLiquidityZones(candles []events.OHLCVCandle) []LiquidityZone {
	zones := []LiquidityZone{}

	// Simplified liquidity zone identification based on volume
	if len(candles) < 20 {
		return zones
	}

	// Find high volume areas
	for i := 10; i < len(candles)-10; i++ {
		volumeSum := 0.0
		priceHigh := candles[i].High
		priceLow := candles[i].Low

		for j := i - 5; j <= i+5; j++ {
			volumeSum += candles[j].Volume
			if candles[j].High > priceHigh {
				priceHigh = candles[j].High
			}
			if candles[j].Low < priceLow {
				priceLow = candles[j].Low
			}
		}

		avgVolume := f.calculateAverageVolume(candles)
		if volumeSum > avgVolume*5 { // High volume threshold
			zones = append(zones, LiquidityZone{
				PriceHigh: priceHigh,
				PriceLow:  priceLow,
				Volume:    volumeSum,
				Density:   volumeSum / (priceHigh - priceLow),
				Type:      "accumulation",
			})
		}
	}

	return zones
}

func (f *HistoricalRealtimeFusion) calculateQualityScore(context *MarketStructureContext) float64 {
	context.mutex.RLock()
	defer context.mutex.RUnlock()

	score := 0.0

	// Data completeness (40%)
	score += context.DataCompleteness * 0.4

	// Historical data quality (30%)
	totalCandles := 0
	for _, candles := range context.HistoricalCandles {
		totalCandles += len(candles)
	}
	if totalCandles > 8000 { // Expecting ~11000 candles (11 timeframes * 1000)
		score += 0.3
	} else {
		score += float64(totalCandles) / 11000.0 * 0.3
	}

	// Market structure data (20%)
	if len(context.KeyLevels) > 0 && len(context.VolumeProfile) > 0 {
		score += 0.2
	}

	// Metrics completeness (10%)
	if len(context.VolatilityMetrics) > 0 && len(context.TrendMetrics) > 0 {
		score += 0.1
	}

	return score
}

// publishFusionStatus publishes overall fusion status
func (f *HistoricalRealtimeFusion) publishFusionStatus() {
	f.statusMutex.RLock()
	defer f.statusMutex.RUnlock()

	statusSummary := map[string]interface{}{
		"fusion_engine":     "historical_realtime_fusion",
		"timestamp":         time.Now().Unix(),
		"uptime_seconds":    time.Since(f.startTime).Seconds(),
		"symbols_total":     len(f.symbolStatus),
		"fusion_complete":   f.fusionComplete,
		"context_updates":   f.contextUpdates,
		"realtime_ingested": f.realtimeIngested,
		"symbols":           f.symbolStatus,
	}

	statusJSON, err := json.Marshal(statusSummary)
	if err != nil {
		log.Printf("❌ Failed to marshal fusion status: %v", err)
		return
	}

	// Publish status to Redis
	err = f.redisClient.Publish(f.ctx, "precision9_fusion_status", statusJSON).Err()
	if err != nil {
		log.Printf("❌ Failed to publish fusion status: %v", err)
	}
}

// monitoringLoop monitors and reports fusion status
func (f *HistoricalRealtimeFusion) monitoringLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-f.ctx.Done():
			return
		case <-ticker.C:
			f.reportFusionStatus()
			f.publishFusionStatus()
		}
	}
}

// reportFusionStatus reports current fusion status
func (f *HistoricalRealtimeFusion) reportFusionStatus() {
	f.statusMutex.RLock()
	defer f.statusMutex.RUnlock()

	log.Println("📊 === HISTORICAL-REALTIME FUSION STATUS ===")
	log.Printf("   Total Symbols: %d", len(f.symbolStatus))
	log.Printf("   Fusion Complete: %d", f.fusionComplete)
	log.Printf("   Realtime Updates: %d", f.realtimeIngested)
	log.Printf("   Uptime: %.1f minutes", time.Since(f.startTime).Minutes())

	// Report per symbol
	readyCount := 0
	for key, status := range f.symbolStatus {
		status.mutex.RLock()
		if status.HistoricalComplete && status.RealtimeActive {
			readyCount++
		}
		log.Printf("   %s: Historical=%v, Realtime=%v, Quality=%.2f",
			key, status.HistoricalComplete, status.RealtimeActive, status.QualityScore)
		status.mutex.RUnlock()
	}

	log.Printf("   Symbols Ready: %d/%d", readyCount, len(f.symbolStatus))
	log.Println("================================================")
}

// GetFusionStatus returns current fusion status
func (f *HistoricalRealtimeFusion) GetFusionStatus() map[string]interface{} {
	f.statusMutex.RLock()
	defer f.statusMutex.RUnlock()

	return map[string]interface{}{
		"symbols":           f.symbolStatus,
		"total_symbols":     len(f.symbolStatus),
		"fusion_complete":   f.fusionComplete,
		"realtime_ingested": f.realtimeIngested,
		"uptime":            time.Since(f.startTime),
	}
}

// Stop stops the fusion engine
func (f *HistoricalRealtimeFusion) Stop() {
	log.Println("🛑 Stopping Historical-Realtime Fusion Engine...")

	f.cancel()

	if f.historicalFetcher != nil {
		f.historicalFetcher.Stop()
	}

	if f.mtfCoordinator != nil {
		f.mtfCoordinator.Stop()
	}

	log.Println("✅ Historical-Realtime Fusion Engine stopped")
}
