package exchanges

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"p9_microstream/internal/analytics"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// BybitMessage represents the structure of Bybit WebSocket messages
type BybitMessage struct {
	Topic string          `json:"topic"`
	Type  string          `json:"type"`
	TS    int64           `json:"ts"`
	Data  json.RawMessage `json:"data"`
}

// BybitTradeData represents trade data from Bybit
type BybitTradeData struct {
	ExecID       string `json:"i"`  // execId -> i
	Symbol       string `json:"s"`  // symbol -> s
	Price        string `json:"p"`  // price -> p
	Size         string `json:"v"`  // size -> v (volume)
	Side         string `json:"S"`  // side -> S (uppercase)
	Time         int64  `json:"T"`  // time -> T (timestamp as int64)
	IsBlockTrade bool   `json:"BT"` // isBlockTrade -> BT
}

// BybitOrderbookData represents orderbook data from Bybit
type BybitOrderbookData struct {
	Symbol   string     `json:"s"`
	Bids     [][]string `json:"b"`
	Asks     [][]string `json:"a"`
	UpdateID int64      `json:"u"`
	Seq      int64      `json:"seq"`
}

// Add this struct after BybitOrderbookData
type BybitKlineData struct {
	Start     int64  `json:"start"`
	End       int64  `json:"end"`
	Interval  string `json:"interval"`
	Open      string `json:"open"`
	Close     string `json:"close"`
	High      string `json:"high"`
	Low       string `json:"low"`
	Volume    string `json:"volume"`
	Turnover  string `json:"turnover"`
	Confirmed bool   `json:"confirm"`
	Symbol    string `json:"symbol"`
}

// BybitConnector handles Bybit WebSocket connections - REAL DATA ONLY
type BybitConnector struct {
	symbol   string
	logger   *zap.Logger
	conn     *websocket.Conn
	ctx      context.Context
	cancel   context.CancelFunc
	Endpoint string // NEW: configurable endpoint
}

// NewBybitConnector creates a new Bybit WebSocket connector
func NewBybitConnector(symbol string, logger *zap.Logger, endpoint string) *BybitConnector {
	ctx, cancel := context.WithCancel(context.Background())
	return &BybitConnector{
		symbol:   symbol,
		logger:   logger,
		ctx:      ctx,
		cancel:   cancel,
		Endpoint: endpoint, // NEW
	}
}

// Start connects to Bybit WebSocket - REAL DATA STREAM
func (b *BybitConnector) Start() error {
	b.logger.Info("[BYBIT-HEARTBEAT] BybitConnector worker starting", zap.String("symbol", b.symbol), zap.String("endpoint", b.Endpoint))
	// Use configurable endpoint
	wsURL := b.Endpoint

	dialer := websocket.Dialer{
		HandshakeTimeout: 45 * time.Second,
	}

	headers := http.Header{}
	headers.Set("User-Agent", "P9-MicroStream/1.0")

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		return fmt.Errorf("failed to connect to Bybit WebSocket: %w", err)
	}

	b.conn = conn
	b.logger.Info("✅ Connected to Bybit WebSocket", zap.String("url", wsURL))

	// Subscribe to real market data streams
	if err := b.subscribe(); err != nil {
		b.conn.Close()
		return fmt.Errorf("failed to subscribe to Bybit streams: %w", err)
	}

	// Start ping handler
	go b.pingHandler()

	return nil
}

// subscribe sends subscription messages for real market data
func (b *BybitConnector) subscribe() error {
	bybitSymbol := b.formatSymbolForBybit(b.symbol)
	if err := b.subscribeToStream(fmt.Sprintf("publicTrade.%s", bybitSymbol)); err != nil {
		return err
	}
	if err := b.subscribeToStream(fmt.Sprintf("orderbook.200.%s", bybitSymbol)); err != nil {
		return err
	}
	if err := b.subscribeToStream(fmt.Sprintf("kline.1.%s", bybitSymbol)); err != nil {
		return err
	}
	if err := b.subscribeToStream(fmt.Sprintf("kline.5.%s", bybitSymbol)); err != nil {
		return err
	}
	if err := b.subscribeToStream(fmt.Sprintf("kline.15.%s", bybitSymbol)); err != nil {
		return err
	}
	return nil
}

func (b *BybitConnector) subscribeToStream(streamName string) error {
	subscribeMsg := map[string]interface{}{
		"op":   "subscribe",
		"args": []string{streamName},
	}
	b.logger.Info("[BYBIT] Subscribing to stream", zap.String("stream", streamName))
	if err := b.conn.WriteJSON(subscribeMsg); err != nil {
		return fmt.Errorf("failed to send subscription for %s: %w", streamName, err)
	}
	return nil
}

// formatSymbolForBybit converts symbol format for Bybit API
func (b *BybitConnector) formatSymbolForBybit(symbol string) string {
	// Convert lowercase to uppercase: solusdt -> SOLUSDT
	return strings.ToUpper(symbol)
}

// pingHandler sends periodic ping messages to keep connection alive
func (b *BybitConnector) pingHandler() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-b.ctx.Done():
			return
		case <-ticker.C:
			pingMsg := map[string]interface{}{
				"op": "ping",
			}
			if err := b.conn.WriteJSON(pingMsg); err != nil {
				b.logger.Error("Failed to send ping to Bybit", zap.Error(err))
				return
			}
		}
	}
}

// ReadMessage reads messages from Bybit WebSocket and handles control messages
func (b *BybitConnector) ReadMessage() ([]byte, error) {
	for {
		b.conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		_, message, err := b.conn.ReadMessage()
		if err != nil {
			b.logger.Error("[BYBIT-HEARTBEAT] Error reading message from Bybit WebSocket", zap.Error(err))
			return nil, fmt.Errorf("failed to read Bybit message: %w", err)
		}
		b.logger.Info("[BYBIT-HEARTBEAT] Raw message received", zap.ByteString("message", message))

		// Check for control messages (pong, subscription confirmations)
		var parsed map[string]interface{}
		if err := json.Unmarshal(message, &parsed); err == nil {
			if op, ok := parsed["op"].(string); ok {
				switch op {
				case "pong":
					// Successfully received pong, continue to next message
					continue
				case "subscribe":
					// Check if subscription was successful - accept both ret_msg: "SUCCESS" and success: true
					success := false
					if retMsg, ok := parsed["ret_msg"].(string); ok && retMsg == "SUCCESS" {
						success = true
					} else if successFlag, ok := parsed["success"].(bool); ok && successFlag {
						success = true
					}
					
					if success {
						b.logger.Info("Bybit subscription successful", zap.Any("response", parsed))
					} else {
						errMsg := "subscription failed"
						if retMsg, ok := parsed["ret_msg"].(string); ok && retMsg != "" {
							errMsg = fmt.Sprintf("subscription failed: %s", retMsg)
						}
						b.logger.Error("Bybit subscription failed", zap.Any("response", parsed), zap.String("error_message", errMsg), zap.ByteString("raw_message", message))
						return nil, fmt.Errorf(errMsg)
					}
					// Subscription message handled, continue to next data message
					continue
				}
			}
		}

		// If it's not a control message, it's a data message
		return message, nil
	}
}

// ParseMessage parses Bybit WebSocket messages and returns trade/orderbook data
func (b *BybitConnector) ParseMessage(data []byte) (interface{}, error) {
	b.logger.Info("[BYBIT-DEBUG] ParseMessage called", zap.ByteString("raw", data))
	var msg BybitMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		b.logger.Error("[BYBIT-DEBUG] Failed to unmarshal Bybit message", zap.Error(err), zap.ByteString("raw", data))
		return nil, fmt.Errorf("failed to parse Bybit message: %w", err)
	}
	b.logger.Info("[BYBIT-DEBUG] Parsed Bybit message", zap.Any("msg", msg))

	// Handle kline/candle data
	if strings.HasPrefix(msg.Topic, "kline.") {
		b.logger.Info("[BYBIT-DEBUG] Kline topic detected", zap.Any("msg", msg))
		var klines []BybitKlineData
		if err := json.Unmarshal(msg.Data, &klines); err != nil {
			b.logger.Error("[BYBIT-DEBUG] Failed to parse kline data array", zap.Error(err), zap.ByteString("raw", msg.Data))
			return nil, fmt.Errorf("failed to parse kline data array: %w", err)
		}
		if len(klines) == 0 {
			b.logger.Warn("[BYBIT-DEBUG] Empty kline data array", zap.Any("msg", msg))
			return nil, fmt.Errorf("empty kline data array")
		}
		kline := klines[0]
		open, _ := strconv.ParseFloat(kline.Open, 64)
		high, _ := strconv.ParseFloat(kline.High, 64)
		low, _ := strconv.ParseFloat(kline.Low, 64)
		close_, _ := strconv.ParseFloat(kline.Close, 64)
		volume, _ := strconv.ParseFloat(kline.Volume, 64)
		b.logger.Info("[BYBIT-DEBUG] Parsed kline", zap.Any("kline", kline))
		return map[string]interface{}{
			"type":      "candle",
			"exchange":  "bybit",
			"symbol":    strings.ToLower(kline.Symbol),
			"interval":  kline.Interval,
			"open":      open,
			"high":      high,
			"low":       low,
			"close":     close_,
			"volume":    volume,
			"timestamp": kline.Start,
			"confirmed": kline.Confirmed,
		}, nil
	}

	// Handle trade data (data is an array)
	if strings.HasPrefix(msg.Topic, "publicTrade.") {
		b.logger.Info("[BYBIT-DEBUG] Trade topic detected", zap.Any("msg", msg))
		var trades []BybitTradeData
		if err := json.Unmarshal(msg.Data, &trades); err != nil {
			b.logger.Error("[BYBIT-DEBUG] Failed to parse trade data array", zap.Error(err), zap.ByteString("raw", msg.Data))
			return nil, fmt.Errorf("failed to parse trade data array: %w", err)
		}
		if len(trades) == 0 {
			b.logger.Warn("[BYBIT-DEBUG] Empty trade data array", zap.Any("msg", msg))
			return nil, fmt.Errorf("empty trade data array")
		}
		trade := trades[0]
		price, _ := strconv.ParseFloat(trade.Price, 64)
		quantity, _ := strconv.ParseFloat(trade.Size, 64)
		timestamp := trade.Time
		b.logger.Info("[BYBIT-DEBUG] Parsed trade", zap.Any("trade", trade))
		return map[string]interface{}{
			"type":      "trade",
			"exchange":  "bybit",
			"symbol":    strings.ToLower(trade.Symbol),
			"price":     price,
			"quantity":  quantity,
			"side":      strings.ToLower(trade.Side),
			"timestamp": timestamp,
		}, nil
	}

	// Handle orderbook data (data is an object)
	if strings.HasPrefix(msg.Topic, "orderbook.") {
		b.logger.Info("[BYBIT-DEBUG] Orderbook topic detected", zap.Any("msg", msg))
		var orderbook BybitOrderbookData
		if err := json.Unmarshal(msg.Data, &orderbook); err != nil {
			b.logger.Error("[BYBIT-DEBUG] Failed to parse orderbook data", zap.Error(err), zap.ByteString("raw", msg.Data))
			return nil, fmt.Errorf("failed to parse orderbook data object: %w", err)
		}
		b.logger.Info("[BYBIT-DEBUG] Parsed orderbook", zap.Any("orderbook", orderbook))
		bids := make([][]float64, 0, len(orderbook.Bids))
		for _, bid := range orderbook.Bids {
			if len(bid) >= 2 {
				price, _ := strconv.ParseFloat(bid[0], 64)
				quantity, _ := strconv.ParseFloat(bid[1], 64)
				bids = append(bids, []float64{price, quantity})
			}
		}
		asks := make([][]float64, 0, len(orderbook.Asks))
		for _, ask := range orderbook.Asks {
			if len(ask) >= 2 {
				price, _ := strconv.ParseFloat(ask[0], 64)
				quantity, _ := strconv.ParseFloat(ask[1], 64)
				asks = append(asks, []float64{price, quantity})
			}
		}
		b.logger.Info("[BYBIT-DEBUG] Normalized orderbook", zap.Any("bids", bids), zap.Any("asks", asks))
		// After parsing the orderbook message (delta or snapshot), set exchange and normalized symbol
		exchange := "bybit"
		symbol := analytics.NormalizeSymbol(orderbook.Symbol) // or strings.ToLower(orderbook.Symbol)
		b.logger.Info("[BYBIT-ORDERBOOK-EXTRACT] Extracted exchange", zap.String("exchange", exchange), zap.String("symbol", symbol))
		// Pass these to downstream orderbook processing
		return map[string]interface{}{
			"type":      "depth",
			"exchange":  exchange,
			"symbol":    symbol,
			"bids":      bids,
			"asks":      asks,
			"timestamp": msg.TS,
		}, nil
	}

	b.logger.Warn("[BYBIT-DEBUG] Unknown message type", zap.Any("msg", msg))
	return nil, fmt.Errorf("unknown message type: %s", msg.Topic)
}

// Close closes the Bybit WebSocket connection
func (b *BybitConnector) Close() error {
	b.cancel()
	if b.conn != nil {
		return b.conn.Close()
	}
	return nil
}
