package detectors

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"pulseintel/internal/analytics"
	"pulseintel/internal/publisher"
	"pulseintel/internal/utils"
)

// MomentumDetector detects price momentum and volume spikes
type MomentumDetector struct {
	exchange     string
	symbol       string
	redisClient  *redis.Client
	publisher    *publisher.RedisPublisher
	logger       *zap.Logger
	ctx          context.Context
	cancel       context.CancelFunc
	mu           sync.RWMutex

	// Detection state
	priceHistory  []PricePoint
	alerts        []MomentumAlert
	lastAnalysis  time.Time
	currentPrice  float64
}

// PricePoint represents a price data point
type PricePoint struct {
	Price     float64
	Timestamp time.Time
}

// MomentumAlert represents a momentum detection alert
type MomentumAlert struct {
	Symbol       string    `json:"symbol"`
	Exchange     string    `json:"exchange"`
	AlertType    string    `json:"alert_type"`
	Confidence   float64   `json:"confidence"`
	PriceDelta   float64   `json:"price_delta"`
	PercentMove  float64   `json:"percent_move"`
	Direction    string    `json:"direction"`
	Severity     string    `json:"severity"`
	TimeWindow   string    `json:"time_window"`
	CurrentPrice float64   `json:"current_price"`
	Timestamp    time.Time `json:"timestamp"`
	Description  string    `json:"description"`
}

// TradeEvent represents a trade event
type TradeEvent struct {
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Timestamp int64   `json:"timestamp"`
}

// NewMomentumDetector creates a new momentum detector
func NewMomentumDetector(exchange, symbol string, redisClient *redis.Client, publisher *publisher.RedisPublisher, logger *zap.Logger) *MomentumDetector {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &MomentumDetector{
		exchange:     exchange,
		symbol:       symbol,
		redisClient:  redisClient,
		publisher:    publisher,
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
		priceHistory: make([]PricePoint, 0, 1000),
		alerts:       make([]MomentumAlert, 0, 100),
	}
}

// Start begins momentum detection
func (md *MomentumDetector) Start(ctx context.Context) error {
	md.logger.Info("Starting momentum detector",
		zap.String("exchange", md.exchange),
		zap.String("symbol", md.symbol))

	// Subscribe to trade updates
	tradeChannel := fmt.Sprintf("%s:%s:trade", md.exchange, md.symbol)
	pubsub := md.redisClient.Subscribe(ctx, tradeChannel)
	defer pubsub.Close()

	// Analysis ticker
	analysisTicker := time.NewTicker(1 * time.Second)
	defer analysisTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-analysisTicker.C:
			md.performAnalysis()

		case msg := <-pubsub.Channel():
			if msg != nil {
				md.processTradeUpdate(msg.Payload)
			}
		}
	}
}

// Stop stops the momentum detector
func (md *MomentumDetector) Stop() error {
	md.cancel()
	return nil
}

// processTradeUpdate processes incoming trade updates
func (md *MomentumDetector) processTradeUpdate(data string) {
	md.mu.Lock()
	defer md.mu.Unlock()

	// Parse trade data based on exchange
	trade, err := md.parseTradeData(data)
	if err != nil {
		md.logger.Error("Failed to parse trade update", 
			zap.String("worker", "momentum_detector"),
			zap.String("exchange", md.exchange),
			zap.String("symbol", md.symbol),
			zap.String("payload", data[:utils.MinInt(200, len(data))]),
			zap.Error(err))
		return
	}

	// Update price history
	pricePoint := PricePoint{
		Price:     trade.Price,
		Timestamp: trade.Timestamp,
	}
	md.priceHistory = append(md.priceHistory, pricePoint)
	md.currentPrice = trade.Price

	// Clean old data
	md.cleanOldData(trade.Timestamp)
	
	md.logger.Debug("🎯 MOMENTUM DETECTOR PROCESSED TRADE",
		zap.String("symbol", trade.Symbol),
		zap.Float64("price", trade.Price),
		zap.Float64("quantity", trade.Quantity),
		zap.String("side", trade.Side))
}

// parseTradeData parses trade data from different exchanges
func (md *MomentumDetector) parseTradeData(data string) (*analytics.TradeData, error) {
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

	switch md.exchange {
	case "binance":
		return md.parseBinanceTradeData(actualData)
	case "okx":
		return md.parseOKXTradeData(actualData)
	case "bybit":
		return md.parseBybitTradeData(actualData)
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", md.exchange)
	}
}

// parseBinanceTradeData parses Binance trade data
func (md *MomentumDetector) parseBinanceTradeData(data string) (*analytics.TradeData, error) {
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

		return &analytics.TradeData{
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

	return &analytics.TradeData{
		Symbol:    binanceTrade.S,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: time.Unix(tradeTime/1000, 0),
	}, nil
}

// parseOKXTradeData parses OKX trade data
func (md *MomentumDetector) parseOKXTradeData(data string) (*analytics.TradeData, error) {
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

	return &analytics.TradeData{
		Symbol:    trade.InstId,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: time.Unix(timestamp/1000, 0),
	}, nil
}

// parseBybitTradeData parses Bybit trade data
func (md *MomentumDetector) parseBybitTradeData(data string) (*analytics.TradeData, error) {
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

	return &analytics.TradeData{
		Symbol:    trade.S,
		Price:     price,
		Quantity:  quantity,
		Side:      trade.S2,
		Timestamp: time.Unix(timestamp/1000, 0),
	}, nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// performAnalysis analyzes current data for momentum patterns
func (md *MomentumDetector) performAnalysis() {
	md.mu.RLock()
	priceHistory := make([]PricePoint, len(md.priceHistory))
	copy(priceHistory, md.priceHistory)
	md.mu.RUnlock()

	if len(priceHistory) < 10 {
		return
	}

	// Detect price spikes
	alerts := md.detectPriceSpikes(priceHistory)

	// Process and publish alerts
	for _, alert := range alerts {
		if alert.Confidence >= 0.7 {
			md.addAlert(alert)
			md.publishAlert(alert)
		}
	}

	md.lastAnalysis = time.Now()
}

// detectPriceSpikes detects sudden price movements
func (md *MomentumDetector) detectPriceSpikes(priceHistory []PricePoint) []MomentumAlert {
	var alerts []MomentumAlert

	if len(priceHistory) < 5 {
		return alerts
	}

	currentPrice := priceHistory[len(priceHistory)-1].Price
	now := priceHistory[len(priceHistory)-1].Timestamp

	// Check 1-minute price movement
	oneMinuteAgo := now.Add(-1 * time.Minute)
	var startPrice float64
	found := false

	for i := len(priceHistory) - 1; i >= 0; i-- {
		if priceHistory[i].Timestamp.Before(oneMinuteAgo) {
			startPrice = priceHistory[i].Price
			found = true
			break
		}
	}

	if !found {
		return alerts
	}

	// Calculate price movement
	priceDelta := currentPrice - startPrice
	percentMove := (priceDelta / startPrice) * 100

	// Check for significant movement (>1% in 1 minute)
	if math.Abs(percentMove) >= 1.0 {
		confidence := md.calculateSpikeConfidence(math.Abs(percentMove))
		
		direction := "up"
		if priceDelta < 0 {
			direction = "down"
		}

		severity := md.assessSeverity(math.Abs(percentMove))

		alert := MomentumAlert{
			Symbol:       md.symbol,
			Exchange:     md.exchange,
			AlertType:    "price_spike",
			Confidence:   confidence,
			PriceDelta:   priceDelta,
			PercentMove:  percentMove,
			Direction:    direction,
			Severity:     severity,
			TimeWindow:   "1m",
			CurrentPrice: currentPrice,
			Timestamp:    now,
			Description:  fmt.Sprintf("Price spike: %.2f%% move in 1 minute", percentMove),
		}
		alerts = append(alerts, alert)
	}

	return alerts
}

// Helper functions
func (md *MomentumDetector) calculateSpikeConfidence(percentMove float64) float64 {
	// Base confidence increases with movement size
	confidence := 0.5 + (percentMove-1.0)*0.1
	return math.Min(0.95, confidence)
}

func (md *MomentumDetector) assessSeverity(percentMove float64) string {
	if percentMove >= 5.0 {
		return "high"
	} else if percentMove >= 2.0 {
		return "medium"
	}
	return "low"
}

func (md *MomentumDetector) cleanOldData(now time.Time) {
	cutoff := now.Add(-15 * time.Minute)

	var newPriceHistory []PricePoint
	for _, point := range md.priceHistory {
		if point.Timestamp.After(cutoff) {
			newPriceHistory = append(newPriceHistory, point)
		}
	}
	md.priceHistory = newPriceHistory
}

func (md *MomentumDetector) addAlert(alert MomentumAlert) {
	md.mu.Lock()
	defer md.mu.Unlock()

	md.alerts = append(md.alerts, alert)

	if len(md.alerts) > 100 {
		md.alerts = md.alerts[len(md.alerts)-100:]
	}
}

func (md *MomentumDetector) publishAlert(alert MomentumAlert) {
	channel := fmt.Sprintf("%s:%s:momentum_alert", md.exchange, md.symbol)
	
	alertData, err := json.Marshal(alert)
	if err != nil {
		md.logger.Error("Failed to marshal momentum alert", zap.Error(err))
		return
	}

	md.publisher.Publish(channel, string(alertData))
	
	md.logger.Info("Momentum alert published",
		zap.String("type", alert.AlertType),
		zap.Float64("confidence", alert.Confidence),
		zap.String("direction", alert.Direction))
} 