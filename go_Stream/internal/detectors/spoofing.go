package detectors

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

	"p9_microstream/internal/publisher"
)

// minInt returns the minimum of two integers
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SpoofingDetector detects phantom liquidity and order book manipulation
type SpoofingDetector struct {
	exchange     string
	symbol       string
	redisClient  *redis.Client
	publisher    *publisher.RedisPublisher
	logger       *zap.Logger
	ctx          context.Context
	cancel       context.CancelFunc
	mu           sync.RWMutex

	// Detection state
	orderBook    *OrderBookState
	alerts       []SpoofingAlert
	lastAnalysis time.Time
	debugCount   int
}

// OrderBookState represents current orderbook state
type OrderBookState struct {
	Bids      []BookLevel `json:"bids"`
	Asks      []BookLevel `json:"asks"`
	Timestamp time.Time   `json:"timestamp"`
	Symbol    string      `json:"symbol"`
}

// BookLevel represents a single orderbook level
type BookLevel struct {
	Price float64 `json:"price"`
	Size  float64 `json:"size"`
}

// SpoofingAlert represents a spoofing detection alert
type SpoofingAlert struct {
	Symbol      string    `json:"symbol"`
	Exchange    string    `json:"exchange"`
	AlertType   string    `json:"alert_type"`
	Confidence  float64   `json:"confidence"`
	SizeRatio   float64   `json:"size_ratio"`
	PriceLevel  float64   `json:"price_level"`
	Side        string    `json:"side"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
}

// NewSpoofingDetector creates a new spoofing detector
func NewSpoofingDetector(exchange, symbol string, redisClient *redis.Client, publisher *publisher.RedisPublisher, logger *zap.Logger) *SpoofingDetector {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &SpoofingDetector{
		exchange:    exchange,
		symbol:      symbol,
		redisClient: redisClient,
		publisher:   publisher,
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
		orderBook:   &OrderBookState{},
		alerts:      make([]SpoofingAlert, 0, 100),
	}
}

// Start begins spoofing detection
func (sd *SpoofingDetector) Start(ctx context.Context) error {
	sd.logger.Info("Starting spoofing detector",
		zap.String("exchange", sd.exchange),
		zap.String("symbol", sd.symbol))

	// Subscribe to order book updates
	orderBookChannel := fmt.Sprintf("%s:%s:depth", sd.exchange, sd.symbol)
	pubsub := sd.redisClient.Subscribe(ctx, orderBookChannel)
	defer pubsub.Close()

	// Analysis ticker
	analysisTicker := time.NewTicker(500 * time.Millisecond)
	defer analysisTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-analysisTicker.C:
			sd.performAnalysis()

		case msg := <-pubsub.Channel():
			if msg != nil {
				sd.processOrderBookUpdate(msg.Payload)
			}
		}
	}
}

// Stop stops the spoofing detector
func (sd *SpoofingDetector) Stop() error {
	sd.cancel()
	return nil
}

// processOrderBookUpdate processes incoming order book updates
func (sd *SpoofingDetector) processOrderBookUpdate(data string) {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	// Handle double-encoded JSON - unescape if data starts with quoted JSON
	var actualData string
	if strings.HasPrefix(data, "\"") && strings.HasSuffix(data, "\"") {
		// This is double-encoded JSON, unescape it
		var err error
		actualData, err = strconv.Unquote(data)
		if err != nil {
			sd.logger.Warn("Failed to unescape double-encoded JSON", 
				zap.String("raw_data", data[:minInt(200, len(data))]),
				zap.Error(err))
			return
		}
	} else {
		actualData = data
	}

	// First try to parse as Binance depth format (most common)
	var binanceDepth struct {
		LastUpdateId int64      `json:"lastUpdateId"` // Binance uses lastUpdateId
		Bids         [][]string `json:"bids"`         // Bids to be updated
		Asks         [][]string `json:"asks"`         // Asks to be updated
	}

	if err := json.Unmarshal([]byte(actualData), &binanceDepth); err == nil && len(binanceDepth.Bids) > 0 {
		// Convert Binance format to our OrderBookState
		orderBook := &OrderBookState{
			Symbol:    "SOLUSDT", // We know we're processing SOL/USDT
			Timestamp: time.Now(),
			Bids:      make([]BookLevel, 0, len(binanceDepth.Bids)),
			Asks:      make([]BookLevel, 0, len(binanceDepth.Asks)),
		}

		// Convert bids
		for _, bid := range binanceDepth.Bids {
			if len(bid) >= 2 {
				price, _ := strconv.ParseFloat(bid[0], 64)
				size, _ := strconv.ParseFloat(bid[1], 64)
				if size > 0 { // Only add non-zero quantities
					orderBook.Bids = append(orderBook.Bids, BookLevel{
						Price: price,
						Size:  size,
					})
				}
			}
		}

		// Convert asks
		for _, ask := range binanceDepth.Asks {
			if len(ask) >= 2 {
				price, _ := strconv.ParseFloat(ask[0], 64)
				size, _ := strconv.ParseFloat(ask[1], 64)
				if size > 0 { // Only add non-zero quantities
					orderBook.Asks = append(orderBook.Asks, BookLevel{
						Price: price,
						Size:  size,
					})
				}
			}
		}

		sd.orderBook = orderBook
		sd.logger.Debug("📊 ORDER BOOK PARSED SUCCESSFULLY",
			zap.String("symbol", orderBook.Symbol),
			zap.Int("bids", len(orderBook.Bids)),
			zap.Int("asks", len(orderBook.Asks)),
			zap.Int64("update_id", binanceDepth.LastUpdateId))
		return
	}

	// Second try: parse as Binance WebSocket stream format
	var binanceStream struct {
		Stream string `json:"stream"`
		Data   struct {
			E    int64      `json:"E"`    // Event time
			T    int64      `json:"T"`    // Transaction time
			S    string     `json:"s"`    // Symbol
			U    int64      `json:"U"`    // First update ID in event
			U1   int64      `json:"u"`    // Final update ID in event
			Bids [][]string `json:"b"`    // Bids to be updated
			Asks [][]string `json:"a"`    // Asks to be updated
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(actualData), &binanceStream); err == nil && binanceStream.Data.S != "" {
		// Convert Binance WebSocket stream format to our OrderBookState
		depthData := binanceStream.Data
		orderBook := &OrderBookState{
			Symbol:    depthData.S,
			Timestamp: time.Now(),
			Bids:      make([]BookLevel, 0, len(depthData.Bids)),
			Asks:      make([]BookLevel, 0, len(depthData.Asks)),
		}

		// Convert bids
		for _, bid := range depthData.Bids {
			if len(bid) >= 2 {
				price, _ := strconv.ParseFloat(bid[0], 64)
				size, _ := strconv.ParseFloat(bid[1], 64)
				if size > 0 { // Only add non-zero quantities
					orderBook.Bids = append(orderBook.Bids, BookLevel{
						Price: price,
						Size:  size,
					})
				}
			}
		}

		// Convert asks
		for _, ask := range depthData.Asks {
			if len(ask) >= 2 {
				price, _ := strconv.ParseFloat(ask[0], 64)
				size, _ := strconv.ParseFloat(ask[1], 64)
				if size > 0 { // Only add non-zero quantities
					orderBook.Asks = append(orderBook.Asks, BookLevel{
						Price: price,
						Size:  size,
					})
				}
			}
		}

		sd.orderBook = orderBook
		sd.logger.Debug("📊 ORDER BOOK PARSED (STREAM FORMAT)",
			zap.String("symbol", orderBook.Symbol),
			zap.Int("bids", len(orderBook.Bids)),
			zap.Int("asks", len(orderBook.Asks)))
		return
	}

	// Third try: parse as structured OrderBookState
	var orderBook OrderBookState
	if err := json.Unmarshal([]byte(actualData), &orderBook); err == nil && orderBook.Symbol != "" {
		sd.orderBook = &orderBook
		sd.orderBook.Timestamp = time.Now()
		sd.logger.Debug("📊 ORDER BOOK PARSED AS STRUCTURED",
			zap.String("symbol", orderBook.Symbol),
			zap.Int("bids", len(orderBook.Bids)),
			zap.Int("asks", len(orderBook.Asks)))
		return
	}

	// If all parsing attempts fail, log with sample data for debugging (only occasionally)
	if sd.debugCount%50 == 0 { // Only log every 50th failure to avoid spam
		sampleData := actualData
		if len(actualData) > 200 {
			sampleData = actualData[:200] + "..."
		}
		
		sd.logger.Debug("Order book parsing attempts failed",
			zap.String("sample_data", sampleData),
			zap.Int("data_length", len(actualData)),
			zap.Int("debug_count", sd.debugCount))
	}
	sd.debugCount++
}

// performAnalysis analyzes current order book for spoofing patterns
func (sd *SpoofingDetector) performAnalysis() {
	sd.mu.RLock()
	orderBook := sd.orderBook
	sd.mu.RUnlock()

	if orderBook == nil || orderBook.Timestamp.IsZero() {
		return
	}

	// Skip if data is too old
	if time.Since(orderBook.Timestamp) > 5*time.Second {
		return
	}

	// Detect phantom liquidity
	alerts := sd.detectPhantomLiquidity(orderBook)

	// Process and publish alerts
	for _, alert := range alerts {
		if alert.Confidence >= 0.7 {
			sd.addAlert(alert)
			sd.publishAlert(alert)
		}
	}

	sd.lastAnalysis = time.Now()
}

// detectPhantomLiquidity detects phantom liquidity patterns
func (sd *SpoofingDetector) detectPhantomLiquidity(orderBook *OrderBookState) []SpoofingAlert {
	var alerts []SpoofingAlert

	if len(orderBook.Bids) == 0 || len(orderBook.Asks) == 0 {
		return alerts
	}

	// Analyze both sides
	for _, side := range []string{"bid", "ask"} {
		levels := orderBook.Bids
		if side == "ask" {
			levels = orderBook.Asks
		}

		if len(levels) < 3 {
			continue
		}

		// Calculate average size for comparison
		avgSize := sd.calculateAverageSize(levels)

		// Look for unusually large orders
		for i, level := range levels {
			if i == 0 {
				continue // Skip best price level
			}

			sizeRatio := level.Size / avgSize
			if sizeRatio >= 3.0 { // Threshold for suspicion
				confidence := sd.calculateConfidence(sizeRatio, i, len(levels))
				
				if confidence >= 0.7 {
					alert := SpoofingAlert{
						Symbol:      sd.symbol,
						Exchange:    sd.exchange,
						AlertType:   "phantom_liquidity",
						Confidence:  confidence,
						SizeRatio:   sizeRatio,
						PriceLevel:  level.Price,
						Side:        side,
						Description: fmt.Sprintf("Large phantom order detected: %.2fx normal size", sizeRatio),
						Timestamp:   time.Now(),
					}
					alerts = append(alerts, alert)
				}
			}
		}
	}

	return alerts
}

// Helper functions
func (sd *SpoofingDetector) calculateAverageSize(levels []BookLevel) float64 {
	if len(levels) == 0 {
		return 1.0
	}

	total := 0.0
	for _, level := range levels {
		total += level.Size
	}

	return total / float64(len(levels))
}

func (sd *SpoofingDetector) calculateConfidence(sizeRatio float64, position, totalLevels int) float64 {
	// Base confidence from size ratio
	sizeConfidence := minFloat64(0.5, sizeRatio/10.0)
	
	// Position confidence (farther from best price = more suspicious)
	positionConfidence := minFloat64(0.4, float64(position)/float64(totalLevels))
	
	total := sizeConfidence + positionConfidence
	return minFloat64(0.95, total)
}

// minFloat64 returns the minimum of two float64 values
func minFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func (sd *SpoofingDetector) addAlert(alert SpoofingAlert) {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	sd.alerts = append(sd.alerts, alert)

	// Maintain max alerts limit
	if len(sd.alerts) > 100 {
		sd.alerts = sd.alerts[len(sd.alerts)-100:]
	}
}

func (sd *SpoofingDetector) publishAlert(alert SpoofingAlert) {
	channel := fmt.Sprintf("%s:%s:spoofing", sd.exchange, sd.symbol)
	
	alertData, err := json.Marshal(alert)
	if err != nil {
		sd.logger.Error("Failed to marshal spoofing alert", zap.Error(err))
		return
	}

	sd.publisher.Publish(channel, string(alertData))
	
	sd.logger.Info("Spoofing alert published",
		zap.String("type", alert.AlertType),
		zap.Float64("confidence", alert.Confidence),
		zap.String("side", alert.Side))
} 