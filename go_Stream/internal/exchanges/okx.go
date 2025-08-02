package exchanges

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// OKXConnector handles WebSocket connections to OKX
type OKXConnector struct {
	config         OKXConfig
	conn           *websocket.Conn
	logger         *zap.Logger
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

// OKXConfig holds configuration for OKX connector
type OKXConfig struct {
	Endpoint       string
	Symbols        []string
	Channels       []string
	ReconnectDelay time.Duration
	MaxReconnects  int
	PingInterval   time.Duration
	WriteWait      time.Duration
	ReadWait       time.Duration
	MaxMessageSize int64
}

// OKXTradeMessage represents an OKX trade message
type OKXTradeMessage struct {
	Arg struct {
		Channel string `json:"channel"`
		InstID  string `json:"instId"`
	} `json:"arg"`
	Data []struct {
		InstID    string `json:"instId"`
		TradeID   string `json:"tradeId"`
		Price     string `json:"px"`
		Size      string `json:"sz"`
		Side      string `json:"side"`
		Timestamp string `json:"ts"`
	} `json:"data"`
}

// OKXOrderBookMessage represents an OKX order book message
type OKXOrderBookMessage struct {
	Arg struct {
		Channel string `json:"channel"`
		InstID  string `json:"instId"`
	} `json:"arg"`
	Data []struct {
		InstID    string     `json:"instId"`
		Bids      [][]string `json:"bids"`
		Asks      [][]string `json:"asks"`
		Timestamp string     `json:"ts"`
		Checksum  int        `json:"checksum"`
	} `json:"data"`
}

// NewOKXConnector creates a new OKX WebSocket connector
func NewOKXConnector(config OKXConfig, logger *zap.Logger) *OKXConnector {
	ctx, cancel := context.WithCancel(context.Background())

	return &OKXConnector{
		config:         config,
		logger:         logger,
		ctx:            ctx,
		cancel:         cancel,
		messageChannel: make(chan []byte, 5000),
		errorChannel:   make(chan error, 100),
		closeChannel:   make(chan struct{}),
		connected:      false,
		reconnectCount: 0,
	}
}

// Connect establishes WebSocket connection to OKX
func (oc *OKXConnector) Connect(symbol string) error {
	oc.mu.Lock()
	defer oc.mu.Unlock()

	if oc.connected {
		return fmt.Errorf("already connected")
	}

	// Build WebSocket URL for OKX
	wsURL := "wss://ws.okx.com:8443/ws/v5/public"

	oc.logger.Info("Connecting to OKX WebSocket",
		zap.String("url", wsURL),
		zap.String("symbol", symbol),
	)

	// Set up WebSocket dialer
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	// Connect to WebSocket
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to OKX WebSocket: %w", err)
	}

	oc.conn = conn
	oc.connected = true
	oc.reconnectCount = 0

	// Configure connection
	oc.conn.SetReadLimit(oc.config.MaxMessageSize)
	oc.conn.SetReadDeadline(time.Now().Add(oc.config.ReadWait))
	oc.conn.SetPongHandler(func(string) error {
		oc.conn.SetReadDeadline(time.Now().Add(oc.config.ReadWait))
		oc.lastPing = time.Now()
		oc.logger.Debug("Received pong from OKX")
		return nil
	})

	// Set ping handler for server-initiated pings
	oc.conn.SetPingHandler(func(message string) error {
		oc.conn.SetWriteDeadline(time.Now().Add(oc.config.WriteWait))
		if err := oc.conn.WriteMessage(websocket.PongMessage, []byte(message)); err != nil {
			oc.logger.Error("Failed to send pong response to OKX", zap.Error(err))
			return err
		}
		oc.lastPing = time.Now()
		oc.logger.Debug("Responded to ping from OKX")
		return nil
	})

	oc.logger.Info("Successfully connected to OKX WebSocket", zap.String("symbol", symbol))

	// Subscribe to channels
	if err := oc.subscribeToChannels(symbol); err != nil {
		oc.Close()
		return fmt.Errorf("failed to subscribe to channels: %w", err)
	}

	// Start message reading goroutine
	go oc.readMessages()

	// Start ping routine
	go oc.pingRoutine()

	return nil
}

// subscribeToChannels sends subscription message for trade and orderbook data
func (oc *OKXConnector) subscribeToChannels(symbol string) error {
	// For perpetual swaps, OKX requires the -SWAP suffix.
	// We'll construct the instId: solusdt -> SOL-USDT-SWAP
	// Correction: symbol comes in as 'solusdt', needs to be 'sol-usdt' first
	var instID string
	if strings.Contains(symbol, "-") {
		instID = fmt.Sprintf("%s-SWAP", strings.ToUpper(symbol))
	} else if len(symbol) > 4 && strings.ToLower(symbol[len(symbol)-4:]) == "usdt" {
		base := strings.ToUpper(symbol[:len(symbol)-4])
		instID = fmt.Sprintf("%s-USDT-SWAP", base)
	} else {
		// Fallback for any other format, though less likely
		instID = fmt.Sprintf("%s-SWAP", strings.ToUpper(symbol))
	}

	// OKX subscription message format
	subscribeMsg := map[string]interface{}{
		"op": "subscribe",
		"args": []map[string]string{
			{
				"channel": "trades",
				"instId":  instID,
			},
			{
				"channel": "books", // 400-level depth book
				"instId":  instID,
			},
		},
	}

	msgBytes, err := json.Marshal(subscribeMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal subscription message: %w", err)
	}

	oc.conn.SetWriteDeadline(time.Now().Add(oc.config.WriteWait))
	if err := oc.conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
		return fmt.Errorf("failed to send subscription message: %w", err)
	}

	oc.logger.Info("Sent subscription message to OKX",
		zap.String("instId", instID),
		zap.String("message", string(msgBytes)))

	// Wait for and validate subscription confirmation
	oc.conn.SetReadDeadline(time.Now().Add(10 * time.Second)) // 10s timeout for response
	_, response, err := oc.conn.ReadMessage()
	if err != nil {
		return fmt.Errorf("failed to read subscription response from OKX: %w", err)
	}

	var respMsg map[string]interface{}
	if err := json.Unmarshal(response, &respMsg); err != nil {
		// If parsing fails, log the raw message for debugging
		oc.logger.Warn("Failed to parse OKX subscription response",
			zap.Error(err),
			zap.String("rawResponse", string(response)))
		// Don't immediately fail, it might be a data message that arrived early.
		// We will proceed but the system may be unstable.
		// A better implementation would have a dedicated message handler loop.
		// For now, we optimistically continue.
	} else {
		if event, ok := respMsg["event"].(string); ok && event == "error" {
			errMsg := "OKX subscription failed"
			if msg, ok := respMsg["msg"].(string); ok {
				errMsg = fmt.Sprintf("%s: %s", errMsg, msg)
			}
			if code, ok := respMsg["code"].(string); ok {
				errMsg = fmt.Sprintf("%s (code: %s)", errMsg, code)
			}
			return fmt.Errorf(errMsg)
		}
		oc.logger.Info("OKX subscription confirmation received", zap.Any("response", respMsg))
	}

	oc.logger.Info("Successfully subscribed to OKX channels", zap.String("instId", instID))
	return nil
}

// Subscribe subscribes to specific channels
func (oc *OKXConnector) Subscribe(channels []string) error {
	// Convert channel names to OKX format
	args := make([]map[string]string, len(channels))
	for i, channel := range channels {
		args[i] = map[string]string{
			"channel": channel,
		}
	}

	subscribeMsg := map[string]interface{}{
		"op":   "subscribe",
		"args": args,
	}

	msgBytes, err := json.Marshal(subscribeMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal subscription message: %w", err)
	}

	oc.mu.RLock()
	conn := oc.conn
	oc.mu.RUnlock()

	if conn == nil {
		return fmt.Errorf("connection is nil")
	}

	conn.SetWriteDeadline(time.Now().Add(oc.config.WriteWait))
	if err := conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
		return fmt.Errorf("failed to send subscription message: %w", err)
	}

	oc.logger.Info("OKX subscription sent", zap.Strings("channels", channels))
	return nil
}

// ReadMessage reads the next message from WebSocket
func (oc *OKXConnector) ReadMessage() ([]byte, error) {
	select {
	case message := <-oc.messageChannel:
		return message, nil
	case err := <-oc.errorChannel:
		return nil, err
	case <-oc.ctx.Done():
		return nil, fmt.Errorf("connector closed")
	}
}

// readMessages continuously reads messages from WebSocket
func (oc *OKXConnector) readMessages() {
	defer func() {
		if r := recover(); r != nil {
			oc.logger.Error("Panic in readMessages", zap.Any("panic", r))
		}
		oc.setConnected(false)
	}()

	for {
		select {
		case <-oc.ctx.Done():
			return
		default:
		}

		oc.mu.RLock()
		conn := oc.conn
		oc.mu.RUnlock()

		if conn == nil {
			oc.errorChannel <- fmt.Errorf("connection is nil")
			return
		}

		messageType, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				oc.logger.Error("WebSocket read error", zap.Error(err))
			}
			oc.errorChannel <- err
			return
		}

		if messageType == websocket.TextMessage {
			// Check for pong response first
			if string(message) == "pong" {
				oc.lastPing = time.Now()
				oc.logger.Debug("Received pong from OKX")
				continue
			}

			// Check for JSON pong response
			var pongResponse map[string]interface{}
			if json.Unmarshal(message, &pongResponse) == nil {
				if event, ok := pongResponse["event"].(string); ok && event == "pong" {
					oc.lastPing = time.Now()
					oc.logger.Debug("Received JSON pong from OKX")
					continue
				}
			}

			// Validate JSON
			if oc.isValidJSON(message) {
				select {
				case oc.messageChannel <- message:
				case <-oc.ctx.Done():
					return
				default:
					oc.logger.Warn("Message channel full, dropping message")
				}
			} else {
				oc.logger.Warn("Received invalid JSON", zap.String("message", string(message)))
			}
		}
	}
}

// isValidJSON checks if the message is valid JSON
func (oc *OKXConnector) isValidJSON(data []byte) bool {
	var js json.RawMessage
	return json.Unmarshal(data, &js) == nil
}

// pingRoutine sends ping messages to keep connection alive
func (oc *OKXConnector) pingRoutine() {
	ticker := time.NewTicker(oc.config.PingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-oc.ctx.Done():
			return
		case <-ticker.C:
			oc.mu.RLock()
			conn := oc.conn
			connected := oc.connected
			oc.mu.RUnlock()

			if !connected || conn == nil {
				return
			}

			// OKX uses simple ping string
			conn.SetWriteDeadline(time.Now().Add(oc.config.WriteWait))
			if err := conn.WriteMessage(websocket.TextMessage, []byte("ping")); err != nil {
				oc.logger.Error("Failed to send ping", zap.Error(err))
				oc.errorChannel <- err
				return
			}

			oc.logger.Debug("Ping sent to OKX")
		}
	}
}

// IsConnected returns the connection status
func (oc *OKXConnector) IsConnected() bool {
	oc.mu.RLock()
	defer oc.mu.RUnlock()
	return oc.connected
}

// setConnected safely sets the connection status
func (oc *OKXConnector) setConnected(status bool) {
	oc.mu.Lock()
	defer oc.mu.Unlock()
	oc.connected = status
}

// Close closes the WebSocket connection
func (oc *OKXConnector) Close() error {
	oc.mu.Lock()
	defer oc.mu.Unlock()

	if !oc.connected || oc.conn == nil {
		return nil
	}

	oc.logger.Info("Closing OKX WebSocket connection")

	// Send close message
	oc.conn.SetWriteDeadline(time.Now().Add(time.Second))
	oc.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))

	// Close the connection
	err := oc.conn.Close()
	oc.connected = false
	oc.conn = nil

	// Cancel context to stop goroutines
	oc.cancel()

	return err
}

// Reconnect attempts to reconnect to OKX
func (oc *OKXConnector) Reconnect(symbol string) error {
	oc.Close()

	// Wait before reconnecting
	backoffDelay := oc.calculateBackoffDelay()
	time.Sleep(backoffDelay)

	oc.reconnectCount++
	return oc.Connect(symbol)
}

// calculateBackoffDelay calculates exponential backoff delay
func (oc *OKXConnector) calculateBackoffDelay() time.Duration {
	baseDelay := oc.config.ReconnectDelay
	maxDelay := 60 * time.Second

	delay := baseDelay * time.Duration(1<<uint(oc.reconnectCount))
	if delay > maxDelay {
		delay = maxDelay
	}

	return delay
}

// GetConnectionStats returns connection statistics
func (oc *OKXConnector) GetConnectionStats() OKXConnectionStats {
	oc.mu.RLock()
	defer oc.mu.RUnlock()

	return OKXConnectionStats{
		Connected:      oc.connected,
		ReconnectCount: oc.reconnectCount,
		LastPing:       oc.lastPing,
		MessageBuffer:  len(oc.messageChannel),
		ErrorBuffer:    len(oc.errorChannel),
	}
}

// OKXConnectionStats holds connection statistics
type OKXConnectionStats struct {
	Connected      bool      `json:"connected"`
	ReconnectCount int       `json:"reconnect_count"`
	LastPing       time.Time `json:"last_ping"`
	MessageBuffer  int       `json:"message_buffer"`
	ErrorBuffer    int       `json:"error_buffer"`
}

// ParseTradeMessage parses an OKX trade message
func (oc *OKXConnector) ParseTradeMessage(data []byte) (*OKXTradeMessage, error) {
	var tradeMsg OKXTradeMessage
	if err := json.Unmarshal(data, &tradeMsg); err != nil {
		return nil, fmt.Errorf("failed to parse trade message: %w", err)
	}
	return &tradeMsg, nil
}

// ParseOrderBookMessage parses an OKX order book message
func (oc *OKXConnector) ParseOrderBookMessage(data []byte) (*OKXOrderBookMessage, error) {
	var obMsg OKXOrderBookMessage
	if err := json.Unmarshal(data, &obMsg); err != nil {
		return nil, fmt.Errorf("failed to parse order book message: %w", err)
	}
	return &obMsg, nil
}

// Health returns the health status of the connector
func (oc *OKXConnector) Health() bool {
	oc.mu.RLock()
	defer oc.mu.RUnlock()

	if !oc.connected || oc.conn == nil {
		return false
	}

	// Check if we haven't received a pong in too long
	if time.Since(oc.lastPing) > 2*oc.config.PingInterval {
		return false
	}

	return true
}
