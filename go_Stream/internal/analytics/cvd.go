package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// CVDCalculator implements cumulative volume delta calculation microservice
type CVDCalculator struct {
	name        string
	exchange    string
	symbol      string
	redisClient *redis.Client
	publisher   EventPublisher
	logger      *zap.Logger

	// CVD data storage
	trades     []TradeEvent
	cvdData    map[time.Duration]float64 // timeframe -> CVD value
	windows    []time.Duration
	lastUpdate time.Time
	tradeCount int64

	// Configuration
	updateInterval  time.Duration
	cleanupInterval time.Duration
	maxTradeHistory int

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.RWMutex
	ticker *time.Ticker
}

// TradeEvent represents a processed trade for CVD calculation
type TradeEvent struct {
	Price     float64
	Quantity  float64
	Side      string // "BUY" or "SELL"
	Timestamp time.Time
	Value     float64 // Price * Quantity
}

// CVDUpdate represents a CVD update event
type CVDUpdate struct {
	Exchange   string             `json:"exchange"`
	Symbol     string             `json:"symbol"`
	CVDValues  map[string]float64 `json:"cvd_values"` // timeframe -> value
	TradeCount int64              `json:"trade_count"`
	LastTrade  TradeEvent         `json:"last_trade"`
	Timestamp  time.Time          `json:"timestamp"`
}

// NewCVDCalculator creates a new CVD calculator microservice
func NewCVDCalculator(exchange, symbol string, redisClient *redis.Client,
	publisher EventPublisher, logger *zap.Logger) *CVDCalculator {

	ctx, cancel := context.WithCancel(context.Background())

	return &CVDCalculator{
		name:            "cvd_calculator",
		exchange:        exchange,
		symbol:          symbol,
		redisClient:     redisClient,
		publisher:       publisher,
		logger:          logger,
		trades:          make([]TradeEvent, 0),
		cvdData:         make(map[time.Duration]float64),
		windows:         []time.Duration{time.Minute, 5 * time.Minute, 15 * time.Minute},
		updateInterval:  time.Second,
		cleanupInterval: time.Minute,
		maxTradeHistory: 10000,
		ctx:             ctx,
		cancel:          cancel,
	}
}

// Start starts the CVD calculator microservice
func (cvd *CVDCalculator) Start(ctx context.Context) error {
	cvd.logger.Info("Starting CVD Calculator microservice",
		zap.String("exchange", cvd.exchange),
		zap.String("symbol", cvd.symbol),
	)

	// Initialize CVD values
	for _, window := range cvd.windows {
		cvd.cvdData[window] = 0.0
	}

	// Start update ticker
	cvd.ticker = time.NewTicker(cvd.updateInterval)

	// Start processing routines
	go cvd.processLoop()
	go cvd.cleanupLoop()

	// Subscribe to trade events
	go cvd.subscribeToTrades()

	return nil
}

// Stop stops the CVD calculator microservice
func (cvd *CVDCalculator) Stop() error {
	cvd.logger.Info("Stopping CVD Calculator microservice")

	cvd.cancel()

	if cvd.ticker != nil {
		cvd.ticker.Stop()
	}

	return nil
}

// Health checks the health of the CVD calculator
func (cvd *CVDCalculator) Health() bool {
	cvd.mu.RLock()
	defer cvd.mu.RUnlock()

	// Check if we've received recent trades
	if time.Since(cvd.lastUpdate) > 5*time.Minute {
		return false
	}

	return true
}

// Name returns the microservice name
func (cvd *CVDCalculator) Name() string {
	return cvd.name
}

// ProcessTrade processes a new trade event
func (cvd *CVDCalculator) ProcessTrade(trade TradeEvent) {
	cvd.mu.Lock()
	defer cvd.mu.Unlock()

	// Add trade to history
	cvd.trades = append(cvd.trades, trade)
	cvd.tradeCount++
	cvd.lastUpdate = time.Now()

	// Limit trade history size
	if len(cvd.trades) > cvd.maxTradeHistory {
		// Remove oldest 10% of trades
		removeCount := cvd.maxTradeHistory / 10
		cvd.trades = cvd.trades[removeCount:]
	}

	cvd.logger.Debug("Trade processed",
		zap.String("symbol", cvd.symbol),
		zap.Float64("price", trade.Price),
		zap.Float64("quantity", trade.Quantity),
		zap.String("side", trade.Side),
	)
}

// subscribeToTrades subscribes to trade events from Redis
func (cvd *CVDCalculator) subscribeToTrades() {
	channel := fmt.Sprintf("%s:%s:trade", cvd.exchange, cvd.symbol)
	pubsub := cvd.redisClient.Subscribe(cvd.ctx, channel)
	defer pubsub.Close()

	cvd.logger.Info("Subscribed to trade events", zap.String("channel", channel))

	for {
		select {
		case <-cvd.ctx.Done():
			return
		case msg := <-pubsub.Channel():
			cvd.handleTradeMessage(msg.Payload)
		}
	}
}

// handleTradeMessage processes incoming trade messages
func (cvd *CVDCalculator) handleTradeMessage(payload string) {
	// Parse trade data based on exchange
	trade, err := cvd.parseTradeData(payload)
	if err != nil {
		cvd.logger.Error("Failed to parse trade message",
			zap.String("worker", "cvd_calculator"),
			zap.String("exchange", cvd.exchange),
			zap.String("symbol", cvd.symbol),
			zap.String("payload", payload[:min(200, len(payload))]),
			zap.Error(err))
		return
	}

	// Create trade event
	tradeEvent := TradeEvent{
		Price:     trade.Price,
		Quantity:  trade.Quantity,
		Side:      trade.Side,
		Timestamp: trade.Timestamp,
		Value:     trade.Price * trade.Quantity,
	}

	// Process the trade
	cvd.ProcessTrade(tradeEvent)

	cvd.logger.Info("🔥 REAL TRADE PROCESSED FOR CVD",
		zap.String("worker", "cvd_calculator"),
		zap.String("exchange", cvd.exchange),
		zap.String("symbol", cvd.symbol),
		zap.String("symbol", trade.Symbol),
		zap.Float64("price", trade.Price),
		zap.Float64("quantity", trade.Quantity),
		zap.String("side", trade.Side),
		zap.Float64("value", tradeEvent.Value))
}

// parseTradeData parses trade data from different exchanges
func (cvd *CVDCalculator) parseTradeData(data string) (*TradeData, error) {
	// Handle double-encoded JSON
	var actualData string
	if strings.HasPrefix(data, "\"") && strings.HasSuffix(data, "\"") {
		var err error
		actualData, err = strconv.Unquote(data)
		if err != nil {
			return nil, fmt.Errorf("failed to unescape double-encoded JSON: %w", err)
		}
	} else {
		actualData = data
	}

	switch cvd.exchange {
	case "binance":
		return cvd.parseBinanceTradeData(actualData)
	case "okx":
		return cvd.parseOKXTradeData(actualData)
	case "bybit":
		return cvd.parseBybitTradeData(actualData)
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", cvd.exchange)
	}
}

// parseBinanceTradeData parses Binance trade data
func (cvd *CVDCalculator) parseBinanceTradeData(data string) (*TradeData, error) {
	// Try to parse as Binance stream format first
	var binanceStream struct {
		Stream string `json:"stream"`
		Data   struct {
			E int64  `json:"E"` // Event time
			T int64  `json:"T"` // Trade time
			S string `json:"s"` // Symbol
			P string `json:"p"` // Price
			Q string `json:"q"` // Quantity
			M bool   `json:"m"` // Buyer is maker
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(data), &binanceStream); err == nil && binanceStream.Data.S != "" {
		price, _ := strconv.ParseFloat(binanceStream.Data.P, 64)
		quantity, _ := strconv.ParseFloat(binanceStream.Data.Q, 64)

		side := "BUY"
		if binanceStream.Data.M {
			side = "SELL"
		}

		return &TradeData{
			Symbol:    binanceStream.Data.S,
			Price:     price,
			Quantity:  quantity,
			Side:      side,
			Timestamp: time.Unix(binanceStream.Data.T/1000, 0),
		}, nil
	}

	// Fallback to direct format - handle both uppercase and lowercase field names
	var binanceTrade struct {
		EventType string `json:"e"` // Event type (lowercase) - "trade"
		E         int64  `json:"E"` // Event time (uppercase)
		T         int64  `json:"T"` // Trade time (uppercase)
		S         string `json:"s"` // Symbol (lowercase)
		P         string `json:"p"` // Price (lowercase)
		Q         string `json:"q"` // Quantity (lowercase)
		M         bool   `json:"m"` // Buyer is maker (lowercase)
	}

	if err := json.Unmarshal([]byte(data), &binanceTrade); err != nil {
		return nil, fmt.Errorf("failed to parse Binance trade data: %w", err)
	}

	// Use the correct timestamp field (T is trade time, E is event time)
	tradeTime := binanceTrade.T
	if tradeTime == 0 {
		tradeTime = binanceTrade.E
	}

	price, _ := strconv.ParseFloat(binanceTrade.P, 64)
	quantity, _ := strconv.ParseFloat(binanceTrade.Q, 64)

	side := "BUY"
	if binanceTrade.M {
		side = "SELL"
	}

	return &TradeData{
		Symbol:    binanceTrade.S,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: time.Unix(tradeTime/1000, 0),
	}, nil
}

// parseOKXTradeData parses OKX trade data
func (cvd *CVDCalculator) parseOKXTradeData(data string) (*TradeData, error) {
	var okxData struct {
		Arg struct {
			Channel string `json:"channel"`
			InstId  string `json:"instId"`
		} `json:"arg"`
		Data []struct {
			InstId  string `json:"instId"`
			TradeId string `json:"tradeId"`
			Px      string `json:"px"`   // Price
			Sz      string `json:"sz"`   // Size
			Side    string `json:"side"` // buy/sell
			Ts      string `json:"ts"`   // Timestamp
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(data), &okxData); err != nil {
		return nil, fmt.Errorf("failed to parse OKX trade data: %w", err)
	}

	if len(okxData.Data) == 0 {
		return nil, fmt.Errorf("no trade data in OKX message")
	}

	trade := okxData.Data[0]
	price, _ := strconv.ParseFloat(trade.Px, 64)
	quantity, _ := strconv.ParseFloat(trade.Sz, 64)
	timestamp, _ := strconv.ParseInt(trade.Ts, 10, 64)

	side := strings.ToUpper(trade.Side)

	return &TradeData{
		Symbol:    trade.InstId,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: time.Unix(timestamp/1000, 0),
	}, nil
}

// parseBybitTradeData parses Bybit trade data
func (cvd *CVDCalculator) parseBybitTradeData(data string) (*TradeData, error) {
	var bybitData struct {
		Topic string `json:"topic"`
		Type  string `json:"type"`
		Data  []struct {
			T  string `json:"T"` // Timestamp
			S  string `json:"s"` // Symbol
			P  string `json:"p"` // Price
			V  string `json:"v"` // Volume
			S2 string `json:"S"` // Side (Buy/Sell)
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(data), &bybitData); err != nil {
		return nil, fmt.Errorf("failed to parse Bybit trade data: %w", err)
	}

	if len(bybitData.Data) == 0 {
		return nil, fmt.Errorf("no trade data in Bybit message")
	}

	trade := bybitData.Data[0]
	price, _ := strconv.ParseFloat(trade.P, 64)
	quantity, _ := strconv.ParseFloat(trade.V, 64)
	timestamp, _ := strconv.ParseInt(trade.T, 10, 64)

	return &TradeData{
		Symbol:    trade.S,
		Price:     price,
		Quantity:  quantity,
		Side:      trade.S2,
		Timestamp: time.Unix(timestamp/1000, 0),
	}, nil
}

// processLoop runs the main CVD calculation loop
func (cvd *CVDCalculator) processLoop() {
	for {
		select {
		case <-cvd.ctx.Done():
			return
		case <-cvd.ticker.C:
			cvd.calculateCVD()
		}
	}
}

// calculateCVD calculates CVD for all configured time windows
func (cvd *CVDCalculator) calculateCVD() {
	cvd.mu.Lock()
	defer cvd.mu.Unlock()

	now := time.Now()
	updated := false

	// Calculate CVD for each time window
	for _, window := range cvd.windows {
		newCVD := cvd.calculateCVDForWindow(now.Add(-window))
		if cvd.cvdData[window] != newCVD {
			cvd.cvdData[window] = newCVD
			updated = true
		}
	}

	// Publish update if there were changes
	if updated && len(cvd.trades) > 0 {
		cvd.publishCVDUpdate()
	}
}

// calculateCVDForWindow calculates CVD for a specific time window
func (cvd *CVDCalculator) calculateCVDForWindow(since time.Time) float64 {
	var delta float64

	for _, trade := range cvd.trades {
		if trade.Timestamp.After(since) {
			// Using tagged switch for clarity and performance
			switch trade.Side {
			case "BUY":
				delta += trade.Value
			case "SELL":
				delta -= trade.Value
			}
		}
	}

	return delta
}

// publishCVDUpdate publishes a CVD update event
func (cvd *CVDCalculator) publishCVDUpdate() {
	// Convert durations to strings for JSON compatibility
	cvdValues := make(map[string]float64)
	for window, value := range cvd.cvdData {
		cvdValues[window.String()] = value
	}

	var lastTrade TradeEvent
	if len(cvd.trades) > 0 {
		lastTrade = cvd.trades[len(cvd.trades)-1]
	}

	update := CVDUpdate{
		Exchange:   cvd.exchange,
		Symbol:     cvd.symbol,
		CVDValues:  cvdValues,
		TradeCount: cvd.tradeCount,
		LastTrade:  lastTrade,
		Timestamp:  time.Now(),
	}

	channel := fmt.Sprintf("%s:%s:cvd_update", cvd.exchange, cvd.symbol)
	if err := cvd.publisher.Publish(channel, update); err != nil {
		cvd.logger.Error("Failed to publish CVD update",
			zap.Error(err),
			zap.String("channel", channel),
		)
	} else {
		cvd.logger.Debug("CVD update published",
			zap.String("channel", channel),
			zap.Any("cvd_values", cvdValues),
		)
	}
}

// cleanupLoop periodically cleans up old trade data
func (cvd *CVDCalculator) cleanupLoop() {
	cleanupTicker := time.NewTicker(cvd.cleanupInterval)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-cvd.ctx.Done():
			return
		case <-cleanupTicker.C:
			cvd.cleanupOldTrades()
		}
	}
}

// cleanupOldTrades removes trades older than the longest time window
func (cvd *CVDCalculator) cleanupOldTrades() {
	cvd.mu.Lock()
	defer cvd.mu.Unlock()

	if len(cvd.trades) == 0 {
		return
	}

	// Find the longest window
	maxWindow := cvd.windows[0]
	for _, window := range cvd.windows {
		if window > maxWindow {
			maxWindow = window
		}
	}

	// Remove trades older than max window + buffer
	cutoff := time.Now().Add(-(maxWindow + 5*time.Minute))
	validTrades := make([]TradeEvent, 0)

	for _, trade := range cvd.trades {
		if trade.Timestamp.After(cutoff) {
			validTrades = append(validTrades, trade)
		}
	}

	removedCount := len(cvd.trades) - len(validTrades)
	cvd.trades = validTrades

	if removedCount > 0 {
		cvd.logger.Debug("Cleaned up old trades",
			zap.Int("removed", removedCount),
			zap.Int("remaining", len(cvd.trades)),
		)
	}
}

// GetCVDData returns current CVD data
func (cvd *CVDCalculator) GetCVDData() map[time.Duration]float64 {
	cvd.mu.RLock()
	defer cvd.mu.RUnlock()

	// Return a copy to avoid concurrent access issues
	result := make(map[time.Duration]float64)
	for k, v := range cvd.cvdData {
		result[k] = v
	}

	return result
}

// GetTradeCount returns the total number of trades processed
func (cvd *CVDCalculator) GetTradeCount() int64 {
	cvd.mu.RLock()
	defer cvd.mu.RUnlock()
	return cvd.tradeCount
}

// GetStats returns CVD calculator statistics
func (cvd *CVDCalculator) GetStats() CVDStats {
	cvd.mu.RLock()
	defer cvd.mu.RUnlock()

	stats := CVDStats{
		Exchange:         cvd.exchange,
		Symbol:           cvd.symbol,
		TradeCount:       cvd.tradeCount,
		LastUpdate:       cvd.lastUpdate,
		TradeHistorySize: len(cvd.trades),
		CVDValues:        make(map[string]float64),
	}

	for window, value := range cvd.cvdData {
		stats.CVDValues[window.String()] = value
	}

	return stats
}

// CVDStats holds CVD calculator statistics
type CVDStats struct {
	Exchange         string             `json:"exchange"`
	Symbol           string             `json:"symbol"`
	TradeCount       int64              `json:"trade_count"`
	LastUpdate       time.Time          `json:"last_update"`
	TradeHistorySize int                `json:"trade_history_size"`
	CVDValues        map[string]float64 `json:"cvd_values"`
}

// SetWindows sets the time windows for CVD calculation
func (cvd *CVDCalculator) SetWindows(windows []time.Duration) {
	cvd.mu.Lock()
	defer cvd.mu.Unlock()

	cvd.windows = windows

	// Reinitialize CVD data
	cvd.cvdData = make(map[time.Duration]float64)
	for _, window := range windows {
		cvd.cvdData[window] = 0.0
	}

	cvd.logger.Info("CVD time windows updated",
		zap.Any("windows", windows),
	)
}
