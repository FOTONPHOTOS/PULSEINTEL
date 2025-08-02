package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"pulseintel/internal/config"
)

// ============================================================================
// COMPREHENSIVE ORDERBOOK ANALYZER
// ============================================================================

// OrderBookSnapshot represents a complete orderbook snapshot for liquidity analysis
type OrderBookSnapshot struct {
	Exchange         string    `json:"exchange"`
	Symbol           string    `json:"symbol"`
	Bids             []Level   `json:"bids"` // All bid levels
	Asks             []Level   `json:"asks"` // All ask levels
	BestBid          float64   `json:"best_bid"`
	BestAsk          float64   `json:"best_ask"`
	Spread           float64   `json:"spread"`
	SpreadPercent    float64   `json:"spread_percent"`
	TotalBidVolume   float64   `json:"total_bid_volume"`
	TotalAskVolume   float64   `json:"total_ask_volume"`
	BidAskImbalance  float64   `json:"bid_ask_imbalance"`  // Ratio of bid to ask volume
	LiquidityDepth5  float64   `json:"liquidity_depth_5"`  // Combined volume in top 5 levels
	LiquidityDepth10 float64   `json:"liquidity_depth_10"` // Combined volume in top 10 levels
	LiquidityDepth20 float64   `json:"liquidity_depth_20"` // Combined volume in top 20 levels
	WallDetection    WallInfo  `json:"wall_detection"`     // Large orders creating walls
	UpdateID         int64     `json:"update_id"`
	Timestamp        time.Time `json:"timestamp"`
}

// WallInfo represents large order walls in the orderbook
type WallInfo struct {
	BidWalls []OrderWall `json:"bid_walls"`
	AskWalls []OrderWall `json:"ask_walls"`
}

// OrderWall represents a significant liquidity wall
type OrderWall struct {
	Price           float64 `json:"price"`
	Volume          float64 `json:"volume"`
	Value           float64 `json:"value"`
	DistanceFromMid float64 `json:"distance_from_mid"` // Distance from mid price
	Significance    string  `json:"significance"`      // "MINOR", "MODERATE", "MAJOR", "MASSIVE"
}

// Level represents a single price level in order book
type Level struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
}

// OrderBookDelta represents order book changes
type OrderBookDelta struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Bids      []Level   `json:"bids"` // Up to 1000 levels
	Asks      []Level   `json:"asks"` // Up to 1000 levels
	Timestamp time.Time `json:"timestamp"`
	UpdateID  int64     `json:"update_id"`
	IsFinal   bool      `json:"is_final"`
	Checksum  string    `json:"checksum,omitempty"`
}

// OrderBookAnalyzer analyzes orderbook data for liquidity insights
type OrderBookAnalyzer struct {
	redisClient    *redis.Client
	orderBooks     map[string]*OrderBookState // [exchange:symbol] -> OrderBookState
	wallThresholds map[string]float64         // [symbol] -> wall threshold
	mutex          sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
}

// OrderBookState maintains the current state of an orderbook
type OrderBookState struct {
	Exchange     string
	Symbol       string
	Bids         map[float64]float64 // price -> quantity
	Asks         map[float64]float64 // price -> quantity
	LastUpdateID int64
	LastUpdate   time.Time
	mutex        sync.RWMutex
}

// NewOrderBookAnalyzer creates a new orderbook analyzer
func NewOrderBookAnalyzer(redisClient *redis.Client, cfg *config.Config) *OrderBookAnalyzer {
	ctx, cancel := context.WithCancel(context.Background())

	// Build wall thresholds dynamically from YAML
	wallThresholds := make(map[string]float64)
	for symbol, symCfg := range cfg.Symbols {
		if !symCfg.Enabled {
			continue
		}

		thresh := symCfg.WallDetectionThreshold
		if thresh <= 0 {
			thresh = 1000.0 // default if not provided
		}
		wallThresholds[strings.ToLower(symbol)] = thresh
	}

	analyzer := &OrderBookAnalyzer{
		redisClient:    redisClient,
		orderBooks:     make(map[string]*OrderBookState),
		wallThresholds: wallThresholds,
		ctx:            ctx,
		cancel:         cancel,
	}

	log.Println("📚 OrderBook Analyzer initialized with wall thresholds:", wallThresholds)
	return analyzer
}

// ProcessOrderBookDelta processes orderbook updates and generates analysis
func (a *OrderBookAnalyzer) ProcessOrderBookDelta(delta *OrderBookDelta) {
	exKey := strings.ToLower(delta.Exchange)
	symKey := NormalizeSymbol(delta.Symbol)
	key := fmt.Sprintf("%s:%s", exKey, symKey)
	if exKey != "binance" && exKey != "okx" && exKey != "bybit" {
		log.Printf("[ENHANCED-ORDERBOOK-LOG] WARNING: Unknown exchange key: %s (symbol: %s)", exKey, symKey)
	}
	log.Printf("[ENHANCED-ORDERBOOK-LOG] Storing delta under key: %s (exchange: %s, symbol: %s)", key, exKey, symKey)

	a.mutex.Lock()
	defer a.mutex.Unlock()

	// Log the full delta
	bidsPreview, _ := json.Marshal(delta.Bids)
	asksPreview, _ := json.Marshal(delta.Asks)
	if len(bidsPreview) > 200 {
		bidsPreview = bidsPreview[:200]
	}
	if len(asksPreview) > 200 {
		asksPreview = asksPreview[:200]
	}
	log.Printf("DEBUG: [ORDERBOOK] Storing state under key: %s | Exchange: %s | Symbol: %s | Bids: %d | Asks: %d | BidsPreview: %s | AsksPreview: %s", key, delta.Exchange, delta.Symbol, len(delta.Bids), len(delta.Asks), string(bidsPreview), string(asksPreview))

	// Initialize orderbook state if not exists
	if _, exists := a.orderBooks[key]; !exists {
		a.orderBooks[key] = &OrderBookState{
			Exchange: delta.Exchange,
			Symbol:   delta.Symbol,
			Bids:     make(map[float64]float64),
			Asks:     make(map[float64]float64),
		}
	}

	state := a.orderBooks[key]

	// Update orderbook state
	a.updateOrderBookState(state, delta)

	// Generate comprehensive analysis
	snapshot := a.generateOrderBookSnapshot(state)

	// Publish analysis
	a.publishOrderBookSnapshot(snapshot)
}

// updateOrderBookState updates the internal orderbook state
func (a *OrderBookAnalyzer) updateOrderBookState(state *OrderBookState, delta *OrderBookDelta) {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	// Update bids
	for _, level := range delta.Bids {
		if level.Quantity == 0 {
			delete(state.Bids, level.Price)
		} else {
			state.Bids[level.Price] = level.Quantity
		}
	}

	// Update asks
	for _, level := range delta.Asks {
		if level.Quantity == 0 {
			delete(state.Asks, level.Price)
		} else {
			state.Asks[level.Price] = level.Quantity
		}
	}

	state.LastUpdateID = delta.UpdateID
	state.LastUpdate = delta.Timestamp
}

// generateOrderBookSnapshot generates a comprehensive orderbook analysis
func (a *OrderBookAnalyzer) generateOrderBookSnapshot(state *OrderBookState) *OrderBookSnapshot {
	state.mutex.RLock()
	defer state.mutex.RUnlock()

	// Sort and convert to levels
	bidLevels := a.sortBidsDescending(state.Bids)
	askLevels := a.sortAsksAscending(state.Asks)

	// Calculate basic metrics
	bestBid := float64(0)
	bestAsk := float64(0)

	if len(bidLevels) > 0 {
		bestBid = bidLevels[0].Price
	}
	if len(askLevels) > 0 {
		bestAsk = askLevels[0].Price
	}

	spread := bestAsk - bestBid
	spreadPercent := float64(0)
	if bestBid > 0 {
		spreadPercent = (spread / bestBid) * 100
	}

	// Calculate volume metrics
	totalBidVolume := a.calculateTotalVolume(bidLevels)
	totalAskVolume := a.calculateTotalVolume(askLevels)

	bidAskImbalance := float64(0)
	if totalAskVolume > 0 {
		bidAskImbalance = totalBidVolume / totalAskVolume
	}

	// Calculate depth metrics
	liquidityDepth5 := a.calculateDepthLiquidity(bidLevels, askLevels, 5)
	liquidityDepth10 := a.calculateDepthLiquidity(bidLevels, askLevels, 10)
	liquidityDepth20 := a.calculateDepthLiquidity(bidLevels, askLevels, 20)

	// Detect walls
	midPrice := (bestBid + bestAsk) / 2
	wallInfo := a.detectWalls(bidLevels, askLevels, midPrice, state.Symbol)

	return &OrderBookSnapshot{
		Exchange:         state.Exchange,
		Symbol:           state.Symbol,
		Bids:             bidLevels,
		Asks:             askLevels,
		BestBid:          bestBid,
		BestAsk:          bestAsk,
		Spread:           spread,
		SpreadPercent:    spreadPercent,
		TotalBidVolume:   totalBidVolume,
		TotalAskVolume:   totalAskVolume,
		BidAskImbalance:  bidAskImbalance,
		LiquidityDepth5:  liquidityDepth5,
		LiquidityDepth10: liquidityDepth10,
		LiquidityDepth20: liquidityDepth20,
		WallDetection:    wallInfo,
		UpdateID:         state.LastUpdateID,
		Timestamp:        time.Now(),
	}
}

// sortBidsDescending sorts bids in descending order (highest price first)
func (a *OrderBookAnalyzer) sortBidsDescending(bids map[float64]float64) []Level {
	levels := make([]Level, 0, len(bids))
	for price, quantity := range bids {
		levels = append(levels, Level{Price: price, Quantity: quantity})
	}

	sort.Slice(levels, func(i, j int) bool {
		return levels[i].Price > levels[j].Price
	})

	return levels
}

// sortAsksAscending sorts asks in ascending order (lowest price first)
func (a *OrderBookAnalyzer) sortAsksAscending(asks map[float64]float64) []Level {
	levels := make([]Level, 0, len(asks))
	for price, quantity := range asks {
		levels = append(levels, Level{Price: price, Quantity: quantity})
	}

	sort.Slice(levels, func(i, j int) bool {
		return levels[i].Price < levels[j].Price
	})

	return levels
}

// calculateTotalVolume calculates total volume for a set of levels
func (a *OrderBookAnalyzer) calculateTotalVolume(levels []Level) float64 {
	total := float64(0)
	for _, level := range levels {
		total += level.Quantity
	}
	return total
}

// calculateDepthLiquidity calculates liquidity within specified depth
func (a *OrderBookAnalyzer) calculateDepthLiquidity(bids, asks []Level, depth int) float64 {
	liquidity := float64(0)

	// Add bid liquidity
	for i, level := range bids {
		if i >= depth {
			break
		}
		liquidity += level.Quantity
	}

	// Add ask liquidity
	for i, level := range asks {
		if i >= depth {
			break
		}
		liquidity += level.Quantity
	}

	return liquidity
}

// detectWalls detects significant liquidity walls in the orderbook
func (a *OrderBookAnalyzer) detectWalls(bids, asks []Level, midPrice float64, symbol string) WallInfo {
	threshold := a.getWallThreshold(symbol)

	bidWalls := a.findWallsInSide(bids, midPrice, threshold, true)
	askWalls := a.findWallsInSide(asks, midPrice, threshold, false)

	return WallInfo{
		BidWalls: bidWalls,
		AskWalls: askWalls,
	}
}

// findWallsInSide finds walls on one side of the orderbook
func (a *OrderBookAnalyzer) findWallsInSide(levels []Level, midPrice, threshold float64, isBid bool) []OrderWall {
	_ = isBid // Mark as used to avoid compiler warning (reserved for future directional analysis)
	walls := make([]OrderWall, 0)

	for _, level := range levels {
		if level.Quantity >= threshold {
			distanceFromMid := math.Abs(level.Price - midPrice)
			significance := a.determineWallSignificance(level.Quantity, threshold)

			wall := OrderWall{
				Price:           level.Price,
				Volume:          level.Quantity,
				Value:           level.Price * level.Quantity,
				DistanceFromMid: distanceFromMid,
				Significance:    significance,
			}

			walls = append(walls, wall)
		}
	}

	return walls
}

// getWallThreshold gets the wall threshold for a symbol
func (a *OrderBookAnalyzer) getWallThreshold(symbol string) float64 {
	if threshold, exists := a.wallThresholds[strings.ToLower(symbol)]; exists {
		return threshold
	}
	return 100.0 // Default threshold
}

// determineWallSignificance determines the significance of a wall
func (a *OrderBookAnalyzer) determineWallSignificance(volume, threshold float64) string {
	ratio := volume / threshold

	if ratio >= 10 {
		return "MASSIVE"
	} else if ratio >= 5 {
		return "MAJOR"
	} else if ratio >= 2 {
		return "MODERATE"
	}
	return "MINOR"
}

// publishOrderBookSnapshot publishes the orderbook analysis to Redis
func (a *OrderBookAnalyzer) publishOrderBookSnapshot(snapshot *OrderBookSnapshot) {
	channel := fmt.Sprintf("orderbook:%s", strings.ToUpper(snapshot.Symbol))

	data, err := json.Marshal(snapshot)
	if err != nil {
		log.Printf("ERROR: Failed to marshal orderbook snapshot: %v", err)
		return
	}

	err = a.redisClient.Publish(a.ctx, channel, string(data)).Err()
	if err != nil {
		log.Printf("ERROR: Failed to publish orderbook snapshot: %v", err)
		return
	}

	// Log significant walls
	if len(snapshot.WallDetection.BidWalls) > 0 || len(snapshot.WallDetection.AskWalls) > 0 {
		log.Printf("🏗️  WALLS DETECTED: %s - Bid Walls: %d, Ask Walls: %d",
			snapshot.Symbol, len(snapshot.WallDetection.BidWalls), len(snapshot.WallDetection.AskWalls))
	}
}

// Stop stops the orderbook analyzer
func (a *OrderBookAnalyzer) Stop() {
	a.cancel()
	log.Println("📚 OrderBook Analyzer stopped")
}

// GetStats returns statistics about the orderbook analyzer
func (a *OrderBookAnalyzer) GetStats() map[string]interface{} {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	stats := map[string]interface{}{
		"orderbooks_tracked": len(a.orderBooks),
		"wall_thresholds":    a.wallThresholds,
	}

	return stats
}

// Add this method to OrderBookAnalyzer
func (a *OrderBookAnalyzer) getOrderBookState(exchange, symbol string) *OrderBookState {
	exKey := strings.ToLower(exchange)
	symKey := NormalizeSymbol(symbol)
	key := fmt.Sprintf("%s:%s", exKey, symKey)
	state, ok := a.orderBooks[key]
	if ok {
		log.Printf("DEBUG: [ORDERBOOK] Retrieving state with key: %s | FOUND", key)
		return state
	}
	log.Printf("DEBUG: [ORDERBOOK] Retrieving state with key: %s | NOT FOUND", key)
	return nil
}

// Add symbol normalization helper if not present
func NormalizeSymbol(symbol string) string {
	s := strings.ToLower(symbol)
	s = strings.ReplaceAll(s, "-", "")
	return s
}
