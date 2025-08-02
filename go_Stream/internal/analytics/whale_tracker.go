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

// WhaleTracker implements whale detection microservice
type WhaleTracker struct {
	name        string
	exchange    string
	symbol      string
	redisClient *redis.Client
	publisher   EventPublisher
	logger      *zap.Logger
	
	// Whale detection configuration
	threshold      float64 // Minimum quantity to be considered a whale
	minConfidence  float64
	alertCooldown  time.Duration
	
	// Tracking data
	whaleAlerts    []WhaleAlert
	lastAlert      time.Time
	totalWhales    int64
	lastUpdate     time.Time
	
	// Control
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.RWMutex
}

// WhaleAlert represents a whale detection event
type WhaleAlert struct {
	Exchange   string    `json:"exchange"`
	Symbol     string    `json:"symbol"`
	Price      float64   `json:"price"`
	Quantity   float64   `json:"quantity"`
	Value      float64   `json:"value"`
	Side       string    `json:"side"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
	AlertID    string    `json:"alert_id"`
}

// NewWhaleTracker creates a new whale tracker microservice
func NewWhaleTracker(exchange, symbol string, threshold float64, 
	redisClient *redis.Client, publisher EventPublisher, logger *zap.Logger) *WhaleTracker {
	
	ctx, cancel := context.WithCancel(context.Background())
	
	return &WhaleTracker{
		name:          "whale_tracker",
		exchange:      exchange,
		symbol:        symbol,
		threshold:     threshold,
		minConfidence: 0.8,
		alertCooldown: 30 * time.Second,
		redisClient:   redisClient,
		publisher:     publisher,
		logger:        logger,
		whaleAlerts:   make([]WhaleAlert, 0),
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start starts the whale tracker microservice
func (wt *WhaleTracker) Start(ctx context.Context) error {
	wt.logger.Info("Starting Whale Tracker microservice",
		zap.String("exchange", wt.exchange),
		zap.String("symbol", wt.symbol),
		zap.Float64("threshold", wt.threshold),
	)

	// Subscribe to trade events
	go wt.subscribeToTrades()

	return nil
}

// Stop stops the whale tracker microservice
func (wt *WhaleTracker) Stop() error {
	wt.logger.Info("Stopping Whale Tracker microservice")
	wt.cancel()
	return nil
}

// Health checks the health of the whale tracker
func (wt *WhaleTracker) Health() bool {
	wt.mu.RLock()
	defer wt.mu.RUnlock()

	// Check if we've received recent updates
	if time.Since(wt.lastUpdate) > 10*time.Minute {
		return false
	}

	return true
}

// Name returns the microservice name
func (wt *WhaleTracker) Name() string {
	return wt.name
}

// subscribeToTrades subscribes to trade events from Redis
func (wt *WhaleTracker) subscribeToTrades() {
	channel := fmt.Sprintf("%s:%s:trade", wt.exchange, wt.symbol)
	pubsub := wt.redisClient.Subscribe(wt.ctx, channel)
	defer pubsub.Close()

	wt.logger.Info("Subscribed to trade events", zap.String("channel", channel))

	for {
		select {
		case <-wt.ctx.Done():
			return
		case msg := <-pubsub.Channel():
			wt.handleTradeMessage(msg.Payload)
		}
	}
}

// handleTradeMessage processes incoming trade messages
func (wt *WhaleTracker) handleTradeMessage(payload string) {
	// Parse trade data based on exchange
	trade, err := wt.parseTradeData(payload)
	if err != nil {
		wt.logger.Error("Failed to parse trade message", 
			zap.String("worker", "whale_tracker"),
			zap.String("exchange", wt.exchange),
			zap.String("symbol", wt.symbol),
			zap.String("payload", payload[:min(200, len(payload))]),
			zap.Error(err))
		return
	}

	// Update last update time
	wt.mu.Lock()
	wt.lastUpdate = time.Now()
	wt.mu.Unlock()

	// Check for whale activity
	wt.checkWhaleActivity(trade.Price, trade.Quantity, trade.Side)

	wt.logger.Debug("🐋 WHALE TRACKER PROCESSED TRADE",
		zap.String("worker", "whale_tracker"),
		zap.String("exchange", wt.exchange),
		zap.String("symbol", wt.symbol),
		zap.Float64("price", trade.Price),
		zap.Float64("quantity", trade.Quantity),
		zap.String("side", trade.Side))
}

// parseTradeData parses trade data from different exchanges
func (wt *WhaleTracker) parseTradeData(data string) (*TradeData, error) {
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

	switch wt.exchange {
	case "binance":
		return wt.parseBinanceTradeData(actualData)
	case "okx":
		return wt.parseOKXTradeData(actualData)
	case "bybit":
		return wt.parseBybitTradeData(actualData)
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", wt.exchange)
	}
}

// parseBinanceTradeData parses Binance trade data
func (wt *WhaleTracker) parseBinanceTradeData(data string) (*TradeData, error) {
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
		E int64   `json:"E"` // Event time (uppercase)
		T int64   `json:"T"` // Trade time (uppercase)
		S string  `json:"s"` // Symbol (lowercase)
		P string  `json:"p"` // Price (lowercase)
		Q string  `json:"q"` // Quantity (lowercase)
		M bool    `json:"m"` // Buyer is maker (lowercase)
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
func (wt *WhaleTracker) parseOKXTradeData(data string) (*TradeData, error) {
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
func (wt *WhaleTracker) parseBybitTradeData(data string) (*TradeData, error) {
	var bybitData struct {
		Topic string `json:"topic"`
		Type  string `json:"type"`
		Data  []struct {
			T string `json:"T"` // Timestamp
			S string `json:"s"` // Symbol
			P string `json:"p"` // Price
			V string `json:"v"` // Volume
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

// checkWhaleActivity analyzes trade for whale characteristics
func (wt *WhaleTracker) checkWhaleActivity(price, quantity float64, side string) {
	// Check if quantity meets whale threshold
	if quantity < wt.threshold {
		return
	}

	// Check cooldown period
	wt.mu.RLock()
	lastAlert := wt.lastAlert
	wt.mu.RUnlock()

	if time.Since(lastAlert) < wt.alertCooldown {
		return
	}

	// Calculate confidence based on quantity relative to threshold
	confidence := wt.calculateConfidence(quantity)
	
	if confidence < wt.minConfidence {
		return
	}

	// Create whale alert
	alert := WhaleAlert{
		Exchange:   wt.exchange,
		Symbol:     wt.symbol,
		Price:      price,
		Quantity:   quantity,
		Value:      price * quantity,
		Side:       side,
		Confidence: confidence,
		Timestamp:  time.Now(),
		AlertID:    fmt.Sprintf("whale_%d", time.Now().UnixNano()),
	}

	wt.processWhaleAlert(alert)
}

// calculateConfidence calculates confidence score for whale detection
func (wt *WhaleTracker) calculateConfidence(quantity float64) float64 {
	// Confidence increases with quantity relative to threshold
	ratio := quantity / wt.threshold
	
	// Cap confidence at 1.0
	confidence := ratio / 10.0 // Scale factor
	if confidence > 1.0 {
		confidence = 1.0
	}
	
	return confidence
}

// processWhaleAlert processes and publishes a whale alert
func (wt *WhaleTracker) processWhaleAlert(alert WhaleAlert) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	// Add to alert history
	wt.whaleAlerts = append(wt.whaleAlerts, alert)
	wt.totalWhales++
	wt.lastAlert = alert.Timestamp

	// Limit alert history (keep last 100)
	if len(wt.whaleAlerts) > 100 {
		wt.whaleAlerts = wt.whaleAlerts[len(wt.whaleAlerts)-100:]
	}

	// Publish whale alert
	wt.publishWhaleAlert(alert)

	wt.logger.Info("Whale detected!",
		zap.String("symbol", alert.Symbol),
		zap.Float64("quantity", alert.Quantity),
		zap.Float64("value", alert.Value),
		zap.String("side", alert.Side),
		zap.Float64("confidence", alert.Confidence),
	)
}

// publishWhaleAlert publishes a whale alert to Redis
func (wt *WhaleTracker) publishWhaleAlert(alert WhaleAlert) {
	channel := fmt.Sprintf("%s:%s:whale", wt.exchange, wt.symbol)
	
	if err := wt.publisher.Publish(channel, alert); err != nil {
		wt.logger.Error("Failed to publish whale alert",
			zap.Error(err),
			zap.String("channel", channel),
		)
	} else {
		wt.logger.Debug("Whale alert published",
			zap.String("channel", channel),
			zap.String("alert_id", alert.AlertID),
		)
	}
}

// GetWhaleAlerts returns recent whale alerts
func (wt *WhaleTracker) GetWhaleAlerts(limit int) []WhaleAlert {
	wt.mu.RLock()
	defer wt.mu.RUnlock()

	if limit <= 0 || limit > len(wt.whaleAlerts) {
		limit = len(wt.whaleAlerts)
	}

	// Return the most recent alerts
	start := len(wt.whaleAlerts) - limit
	if start < 0 {
		start = 0
	}

	result := make([]WhaleAlert, limit)
	copy(result, wt.whaleAlerts[start:])
	
	return result
}

// GetStats returns whale tracker statistics
func (wt *WhaleTracker) GetStats() WhaleTrackerStats {
	wt.mu.RLock()
	defer wt.mu.RUnlock()

	stats := WhaleTrackerStats{
		Exchange:     wt.exchange,
		Symbol:       wt.symbol,
		Threshold:    wt.threshold,
		TotalWhales:  wt.totalWhales,
		LastAlert:    wt.lastAlert,
		LastUpdate:   wt.lastUpdate,
		AlertCount:   len(wt.whaleAlerts),
	}

	// Calculate recent whale activity (last hour)
	oneHourAgo := time.Now().Add(-time.Hour)
	recentWhales := 0
	var largestWhale WhaleAlert

	for _, alert := range wt.whaleAlerts {
		if alert.Timestamp.After(oneHourAgo) {
			recentWhales++
		}
		if alert.Value > largestWhale.Value {
			largestWhale = alert
		}
	}

	stats.RecentWhales = recentWhales
	stats.LargestWhale = largestWhale

	return stats
}

// WhaleTrackerStats holds whale tracker statistics
type WhaleTrackerStats struct {
	Exchange     string     `json:"exchange"`
	Symbol       string     `json:"symbol"`
	Threshold    float64    `json:"threshold"`
	TotalWhales  int64      `json:"total_whales"`
	RecentWhales int        `json:"recent_whales"`
	LastAlert    time.Time  `json:"last_alert"`
	LastUpdate   time.Time  `json:"last_update"`
	AlertCount   int        `json:"alert_count"`
	LargestWhale WhaleAlert `json:"largest_whale"`
}

// SetThreshold updates the whale detection threshold
func (wt *WhaleTracker) SetThreshold(threshold float64) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	wt.threshold = threshold
	wt.logger.Info("Whale threshold updated", 
		zap.Float64("new_threshold", threshold),
	)
}

// SetMinConfidence updates the minimum confidence requirement
func (wt *WhaleTracker) SetMinConfidence(confidence float64) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	wt.minConfidence = confidence
	wt.logger.Info("Minimum confidence updated", 
		zap.Float64("min_confidence", confidence),
	)
}

// SetAlertCooldown updates the alert cooldown period
func (wt *WhaleTracker) SetAlertCooldown(cooldown time.Duration) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	wt.alertCooldown = cooldown
	wt.logger.Info("Alert cooldown updated", 
		zap.Duration("cooldown", cooldown),
	)
}

// GetConfiguration returns current whale tracker configuration
func (wt *WhaleTracker) GetConfiguration() WhaleTrackerConfig {
	wt.mu.RLock()
	defer wt.mu.RUnlock()

	return WhaleTrackerConfig{
		Threshold:     wt.threshold,
		MinConfidence: wt.minConfidence,
		AlertCooldown: wt.alertCooldown,
	}
}

// WhaleTrackerConfig holds whale tracker configuration
type WhaleTrackerConfig struct {
	Threshold     float64       `json:"threshold"`
	MinConfidence float64       `json:"min_confidence"`
	AlertCooldown time.Duration `json:"alert_cooldown"`
}

// ClearAlertHistory clears the whale alert history
func (wt *WhaleTracker) ClearAlertHistory() {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	wt.whaleAlerts = make([]WhaleAlert, 0)
	wt.logger.Info("Whale alert history cleared")
} 