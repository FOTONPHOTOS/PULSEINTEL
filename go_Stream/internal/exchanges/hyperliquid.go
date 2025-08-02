package exchanges

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// HyperliquidConnector handles WebSocket connections to Hyperliquid
type HyperliquidConnector struct {
	symbol         string
	logger         *zap.Logger
	conn           *websocket.Conn
	connected      bool
	reconnectCount int
	lastPing       time.Time
	mu             sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
	messageChannel chan []byte
	errorChannel   chan error
	closeChannel   chan struct{}
}

// NewHyperliquidConnector creates a new Hyperliquid WebSocket connector
func NewHyperliquidConnector(symbol string, logger *zap.Logger) *HyperliquidConnector {
	ctx, cancel := context.WithCancel(context.Background())
	return &HyperliquidConnector{
		symbol:         symbol,
		logger:         logger,
		ctx:            ctx,
		cancel:         cancel,
		messageChannel: make(chan []byte, 20000),
		errorChannel:   make(chan error, 100),
		closeChannel:   make(chan struct{}),
	}
}

// Connect establishes WebSocket connection to Hyperliquid
func (hc *HyperliquidConnector) Connect() error {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if hc.connected {
		return nil
	}

	wsURL := "wss://api.hyperliquid.xyz/ws"

	hc.logger.Info("Connecting to Hyperliquid WebSocket",
		zap.String("symbol", hc.symbol),
		zap.String("url", wsURL),
	)

	dialer := websocket.Dialer{
		Proxy:            http.ProxyFromEnvironment,
		HandshakeTimeout: 45 * time.Second,
		ReadBufferSize:   4096,
		WriteBufferSize:  4096,
	}

	headers := http.Header{}
	headers.Set("User-Agent", "P9-MicroStream/1.0")

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		hc.reconnectCount++
		return fmt.Errorf("failed to connect to Hyperliquid WebSocket: %w", err)
	}

	hc.conn = conn
	hc.connected = true
	hc.lastPing = time.Now()

	// Set connection options
	hc.conn.SetReadLimit(655350) // 640KB
	hc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	hc.conn.SetPongHandler(func(string) error {
		hc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	hc.logger.Info("Successfully connected to Hyperliquid WebSocket",
		zap.String("symbol", hc.symbol),
	)

	// Subscribe to streams
	if err := hc.subscribe(); err != nil {
		hc.conn.Close()
		return fmt.Errorf("failed to subscribe to Hyperliquid streams: %w", err)
	}

	return nil
}

// Start begins the WebSocket connection and message processing
func (hc *HyperliquidConnector) Start() error {
	if err := hc.Connect(); err != nil {
		return err
	}

	// Start message reading goroutine
	go hc.readMessages()

	// Start ping goroutine
	go hc.pingLoop()

	return nil
}

// subscribe sends subscription messages for real market data
func (hc *HyperliquidConnector) subscribe() error {
	// Hyperliquid uses a different subscription model. We need to send a JSON message.
	// For now, let's subscribe to allMids for the symbol.
	// This will need to be expanded for trades, orderbook, and candles.

	subscribeMsg := map[string]interface{}{
		"method": "subscribe",
		"subscription": map[string]interface{}{
			"type": "allMids",
		},
		"coin": strings.ToUpper(hc.symbol), // Assuming symbol is like "BTC"
	}

	hc.logger.Info("[HYPERLIQUID] Subscribing to stream", zap.Any("message", subscribeMsg))
	if err := hc.conn.WriteJSON(subscribeMsg); err != nil {
		return fmt.Errorf("failed to send subscription for %s: %w", hc.symbol, err)
	}
	return nil
}

// readMessages reads messages from WebSocket connection
func (hc *HyperliquidConnector) readMessages() {
	defer func() {
		hc.mu.Lock()
		hc.connected = false
		if hc.conn != nil {
			hc.conn.Close()
		}
		hc.mu.Unlock()
		close(hc.closeChannel)
	}()

	for {
		select {
		case <-hc.ctx.Done():
			return
		default:
			messageType, message, err := hc.conn.ReadMessage()
			if err != nil {
				hc.logger.Error("WebSocket read error",
					zap.String("symbol", hc.symbol),
					zap.Error(err),
				)
				hc.errorChannel <- err
				return
			}

			if messageType == websocket.TextMessage {
				// Process and normalize the message
				if normalizedData, err := hc.processAndNormalizeMessage(message); err == nil {
					// Marshal the normalized data back to JSON to send through the channel
					if marshaledData, err := json.Marshal(normalizedData); err == nil {
						select {
						case hc.messageChannel <- marshaledData:
						default:
							hc.logger.Warn("Message channel full, dropping normalized message",
								zap.String("symbol", hc.symbol),
							)
						}
					} else {
						hc.logger.Error("Failed to marshal normalized data", zap.Error(err))
					}
				} else {
					hc.logger.Debug("Could not normalize message", zap.Error(err), zap.ByteString("raw_message", message))
				}
			}
		}
	}
}

// processAndNormalizeMessage processes incoming WebSocket messages and normalizes them.
func (hc *HyperliquidConnector) processAndNormalizeMessage(message []byte) (interface{}, error) {
	// Placeholder for Hyperliquid specific message parsing and normalization
	// This will need to be implemented based on Hyperliquid's API documentation
	// For now, just return the raw message as an example.
	var rawMsg map[string]interface{}
	if err := json.Unmarshal(message, &rawMsg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal raw Hyperliquid message: %w", err)
	}

	// Example: if it's an allMids update
	if data, ok := rawMsg["data"]; ok {
		if allMids, ok := data.(map[string]interface{})["allMids"]; ok {
			if mids, ok := allMids.(map[string]interface{})["mids"]; ok {
				if midPriceStr, ok := mids.(map[string]interface{})[strings.ToUpper(hc.symbol)].(string); ok {
					midPrice, err := strconv.ParseFloat(midPriceStr, 64)
					if err != nil {
						return nil, fmt.Errorf("failed to parse mid price: %w", err)
					}
					// For allMids, we'll just return a simplified trade-like structure for now.
					// This needs to be expanded for full trade/depth/candle data.
					return StandardizedTrade{
						Type:      "mid_price",
						Exchange:  "hyperliquid",
						Symbol:    strings.ToLower(hc.symbol),
						Price:     midPrice,
						Quantity:  0, // Not applicable for mid price
						Timestamp: time.Now().UnixMilli(), // Use current time as timestamp
					}, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("unrecognized Hyperliquid message type")
}

// pingLoop sends periodic ping messages to keep connection alive
func (hc *HyperliquidConnector) pingLoop() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-hc.ctx.Done():
			return
		case <-ticker.C:
			hc.mu.RLock()
			if hc.connected && hc.conn != nil {
				// Hyperliquid uses a specific ping message format
				pingMsg := map[string]string{"method": "ping"}
				if err := hc.conn.WriteJSON(pingMsg); err != nil {
					hc.logger.Error("Failed to send ping to Hyperliquid",
						zap.String("symbol", hc.symbol),
						zap.Error(err),
					)
				} else {
					hc.lastPing = time.Now()
					hc.logger.Debug("Sent ping to Hyperliquid",
						zap.String("symbol", hc.symbol),
					)
				}
			}
			hc.mu.RUnlock()
		}
	}
}

// ReadMessage reads a message from the message channel
func (hc *HyperliquidConnector) ReadMessage() ([]byte, error) {
	select {
	case message := <-hc.messageChannel:
		return message, nil
	case err := <-hc.errorChannel:
		return nil, err
	case <-hc.closeChannel:
		return nil, fmt.Errorf("connection closed")
	case <-hc.ctx.Done():
		return nil, hc.ctx.Err()
	}
}

// IsConnected returns the connection status
func (hc *HyperliquidConnector) IsConnected() bool {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.connected
}

// GetReconnectCount returns the number of reconnection attempts
func (hc *HyperliquidConnector) GetReconnectCount() int {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.reconnectCount
}

// Close closes the Hyperliquid WebSocket connection
func (hc *HyperliquidConnector) Close() error {
	hc.cancel()

	hc.mu.Lock()
	defer hc.mu.Unlock()

	if hc.conn != nil {
		hc.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		hc.conn.Close()
		hc.conn = nil
	}

	hc.connected = false

	hc.logger.Info("Hyperliquid WebSocket connection closed",
		zap.String("symbol", hc.symbol),
	)

	return nil
}
