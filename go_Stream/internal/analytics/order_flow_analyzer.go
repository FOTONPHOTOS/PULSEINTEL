package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"pulseintel/internal/config"
	"pulseintel/internal/events"
)

// ============================================================================
// ENHANCED ORDER FLOW ANALYZER
// ============================================================================

// OrderFlowEvent represents enhanced trade data with detailed flow analysis
type OrderFlowEvent struct {
	Exchange       string    `json:"exchange"`
	Symbol         string    `json:"symbol"`
	TradeID        string    `json:"trade_id"`
	Price          float64   `json:"price"`
	Quantity       float64   `json:"quantity"`
	Side           string    `json:"side"`  // "BUY" or "SELL"
	Value          float64   `json:"value"` // price * quantity
	IsBuyerMaker   bool      `json:"is_buyer_maker"`
	IsWhale        bool      `json:"is_whale"`        // Large trade flag
	FlowType       string    `json:"flow_type"`       // "MARKET", "PASSIVE", "AGGRESSIVE"
	LiquidityTaken float64   `json:"liquidity_taken"` // Amount of liquidity consumed
	PriceImpact    float64   `json:"price_impact"`    // Immediate price impact
	BookPressure   string    `json:"book_pressure"`   // "BUY_PRESSURE", "SELL_PRESSURE", "BALANCED"
	MicroTrend     string    `json:"micro_trend"`     // "ACCELERATION", "DECELERATION", "STABLE"
	Timestamp      time.Time `json:"timestamp"`
}

// OrderFlowAnalyzer analyzes trade flow with institutional-grade insights
type OrderFlowAnalyzer struct {
	redisClient     *redis.Client
	priceHistory    map[string]*PriceTracker // [exchange:symbol] -> PriceTracker
	whaleThresholds map[string]float64       // [symbol] -> threshold
	mutex           sync.RWMutex
	ctx             context.Context
	cancel          context.CancelFunc
}

// PriceTracker tracks price movements for impact analysis
type PriceTracker struct {
	Symbol        string
	Exchange      string
	CurrentPrice  float64
	PreviousPrice float64
	LastUpdate    time.Time
	PriceHistory  []PricePoint
	mutex         sync.RWMutex
}

// PricePoint represents a price point in time
type PricePoint struct {
	Price     float64
	Timestamp time.Time
	Volume    float64
}

// NewOrderFlowAnalyzer creates a new order flow analyzer
func NewOrderFlowAnalyzer(redisClient *redis.Client, cfg *config.Config) *OrderFlowAnalyzer {
	ctx, cancel := context.WithCancel(context.Background())

	// Build whale thresholds dynamically from YAML configuration
	whaleThresholds := make(map[string]float64)
	for symbol, symCfg := range cfg.Symbols {
		// Skip disabled symbols
		if !symCfg.Enabled {
			continue
		}

		threshold := symCfg.WhaleThreshold
		if threshold <= 0 {
			// Fallback: derive threshold from BookLevels if provided, else use 1000
			threshold = 1000.0
		}
		whaleThresholds[strings.ToLower(symbol)] = threshold
	}

	analyzer := &OrderFlowAnalyzer{
		redisClient:     redisClient,
		priceHistory:    make(map[string]*PriceTracker),
		whaleThresholds: whaleThresholds,
		ctx:             ctx,
		cancel:          cancel,
	}

	log.Println("📊 Order Flow Analyzer initialized with whale thresholds:", whaleThresholds)
	return analyzer
}

// ProcessTrade processes a trade and generates order flow analysis
func (a *OrderFlowAnalyzer) ProcessTrade(trade *events.Trade) {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	// Update price history
	a.updatePriceHistory(trade)

	// Generate order flow event
	event := a.generateOrderFlowEvent(trade)

	// Publish to Redis
	a.publishOrderFlow(event)
}

// updatePriceHistory updates price history for a symbol
func (a *OrderFlowAnalyzer) updatePriceHistory(trade *events.Trade) {
	key := fmt.Sprintf("%s:%s", trade.Exchange, trade.Symbol)

	// Initialize price tracker if not exists
	if _, exists := a.priceHistory[key]; !exists {
		a.priceHistory[key] = &PriceTracker{
			Symbol:       trade.Symbol,
			Exchange:     trade.Exchange,
			CurrentPrice: trade.Price,
			PriceHistory: make([]PricePoint, 0, 100), // Keep last 100 points
			LastUpdate:   trade.Timestamp,
		}
	}

	tracker := a.priceHistory[key]

	// Update price tracker
	a.updatePriceTracker(tracker, trade)
}

// calculatePriceImpact calculates the immediate price impact of a trade
func (a *OrderFlowAnalyzer) calculatePriceImpact(tracker *PriceTracker, trade *events.Trade) float64 {
	tracker.mutex.RLock()
	defer tracker.mutex.RUnlock()

	if tracker.PreviousPrice == 0 {
		return 0.0
	}

	impact := (trade.Price - tracker.PreviousPrice) / tracker.PreviousPrice * 100
	return impact
}

// isWhaleTransaction determines if a trade qualifies as a whale transaction
func (a *OrderFlowAnalyzer) isWhaleTransaction(trade *events.Trade) bool {
	threshold, exists := a.whaleThresholds[strings.ToLower(trade.Symbol)]
	if !exists {
		threshold = 1000.0 // Default threshold
	}

	return trade.Value >= threshold
}

// determineFlowType determines the type of order flow
func (a *OrderFlowAnalyzer) determineFlowType(trade *events.Trade) string {
	if trade.IsBuyerMaker {
		return "PASSIVE" // Maker order
	}

	// Large trades are typically more aggressive
	if a.isWhaleTransaction(trade) {
		return "AGGRESSIVE"
	}

	return "MARKET"
}

// analyzeBookPressure analyzes the pressure on the order book
func (a *OrderFlowAnalyzer) analyzeBookPressure(tracker *PriceTracker, trade *events.Trade) string {
	tracker.mutex.RLock()
	defer tracker.mutex.RUnlock()

	// Simplified analysis - could be enhanced with actual book data
	if trade.Side == "BUY" && trade.Price > tracker.CurrentPrice {
		return "BUY_PRESSURE"
	} else if trade.Side == "SELL" && trade.Price < tracker.CurrentPrice {
		return "SELL_PRESSURE"
	}

	return "BALANCED"
}

// analyzeMicroTrend analyzes micro price trends
func (a *OrderFlowAnalyzer) analyzeMicroTrend(tracker *PriceTracker, _ *events.Trade) string {
	tracker.mutex.RLock()
	defer tracker.mutex.RUnlock()

	if len(tracker.PriceHistory) < 3 {
		return "STABLE"
	}

	// Look at last 3 price points
	recent := tracker.PriceHistory[len(tracker.PriceHistory)-3:]

	// Calculate price velocity
	priceChange1 := recent[1].Price - recent[0].Price
	priceChange2 := recent[2].Price - recent[1].Price

	if priceChange2 > priceChange1 && priceChange2 > 0 {
		return "ACCELERATION"
	} else if priceChange2 < priceChange1 && priceChange2 < 0 {
		return "DECELERATION"
	}

	return "STABLE"
}

// updatePriceTracker updates the price tracker with new trade data
func (a *OrderFlowAnalyzer) updatePriceTracker(tracker *PriceTracker, trade *events.Trade) {
	tracker.mutex.Lock()
	defer tracker.mutex.Unlock()

	tracker.PreviousPrice = tracker.CurrentPrice
	tracker.CurrentPrice = trade.Price
	tracker.LastUpdate = trade.Timestamp

	// Add to price history
	pricePoint := PricePoint{
		Price:     trade.Price,
		Timestamp: trade.Timestamp,
		Volume:    trade.Quantity,
	}

	tracker.PriceHistory = append(tracker.PriceHistory, pricePoint)

	// Keep only last 100 points
	if len(tracker.PriceHistory) > 100 {
		tracker.PriceHistory = tracker.PriceHistory[1:]
	}
}

// generateOrderFlowEvent generates an order flow event from a trade
func (a *OrderFlowAnalyzer) generateOrderFlowEvent(trade *events.Trade) *OrderFlowEvent {
	// Get the price tracker for this symbol
	key := fmt.Sprintf("%s:%s", trade.Exchange, trade.Symbol)
	tracker := a.priceHistory[key] // This should exist since updatePriceHistory was called first

	// Calculate price impact
	priceImpact := a.calculatePriceImpact(tracker, trade)

	// Determine if this is a whale trade
	isWhale := a.isWhaleTransaction(trade)

	// Determine flow type
	flowType := a.determineFlowType(trade)

	// Analyze book pressure
	bookPressure := a.analyzeBookPressure(tracker, trade)

	// Analyze micro trend
	microTrend := a.analyzeMicroTrend(tracker, trade)

	// Create enhanced order flow event
	event := &OrderFlowEvent{
		Exchange:       trade.Exchange,
		Symbol:         trade.Symbol,
		TradeID:        trade.TradeID,
		Price:          trade.Price,
		Quantity:       trade.Quantity,
		Side:           trade.Side,
		Value:          trade.Value,
		IsBuyerMaker:   trade.IsBuyerMaker,
		IsWhale:        isWhale,
		FlowType:       flowType,
		LiquidityTaken: trade.Quantity, // Simplified - could be enhanced with book data
		PriceImpact:    priceImpact,
		BookPressure:   bookPressure,
		MicroTrend:     microTrend,
		Timestamp:      trade.Timestamp,
	}

	return event
}

// publishOrderFlow publishes the order flow event to Redis
func (a *OrderFlowAnalyzer) publishOrderFlow(event *OrderFlowEvent) {
	channel := fmt.Sprintf("orderflow:%s", strings.ToUpper(event.Symbol))

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ERROR: Failed to marshal order flow event: %v", err)
		return
	}

	err = a.redisClient.Publish(a.ctx, channel, string(data)).Err()
	if err != nil {
		log.Printf("ERROR: Failed to publish order flow: %v", err)
		return
	}

	// Log whale trades
	if event.IsWhale {
		log.Printf("🐋 WHALE FLOW: %s %s %.4f @ %.4f (Impact: %.4f%%, Type: %s)",
			event.Symbol, event.Side, event.Quantity, event.Price, event.PriceImpact, event.FlowType)
	}
}

// Stop stops the order flow analyzer
func (a *OrderFlowAnalyzer) Stop() {
	a.cancel()
	log.Println("📊 Order Flow Analyzer stopped")
}

// GetStats returns statistics about the order flow analyzer
func (a *OrderFlowAnalyzer) GetStats() map[string]interface{} {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	stats := map[string]interface{}{
		"symbols_tracked":  len(a.priceHistory),
		"whale_thresholds": a.whaleThresholds,
	}

	return stats
}

// GetPriceHistory returns price history for a symbol
func (a *OrderFlowAnalyzer) GetPriceHistory(exchange, symbol string) []PricePoint {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	key := fmt.Sprintf("%s:%s", exchange, symbol)
	if tracker, exists := a.priceHistory[key]; exists {
		tracker.mutex.RLock()
		defer tracker.mutex.RUnlock()

		// Return a copy
		history := make([]PricePoint, len(tracker.PriceHistory))
		copy(history, tracker.PriceHistory)
		return history
	}

	return nil
}
