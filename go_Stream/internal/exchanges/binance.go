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

// BinanceConnector handles WebSocket connections to Binance
type BinanceConnector struct {
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

// BinanceTradeData represents Binance trade stream data
type BinanceTradeData struct {
	Stream string `json:"stream"`
	Data   struct {
		EventType     string `json:"e"`
		EventTime     int64  `json:"E"`
		Symbol        string `json:"s"`
		TradeID       int64  `json:"t"`
		Price         string `json:"p"`
		Quantity      string `json:"q"`
		BuyerOrderID  int64  `json:"b"`
		SellerOrderID int64  `json:"a"`
		TradeTime     int64  `json:"T"`
		IsBuyerMaker  bool   `json:"m"`
		Ignore        bool   `json:"M"`
	} `json:"data"`
}

// BinanceDepthData represents Binance depth stream data
type BinanceDepthData struct {
	Stream string `json:"stream"`
	Data   struct {
		EventType   string     `json:"e"`
		EventTime   int64      `json:"E"`
		Symbol      string     `json:"s"`
		FirstUpdate int64      `json:"U"`
		FinalUpdate int64      `json:"u"`
		Bids        [][]string `json:"b"`
		Asks        [][]string `json:"a"`
	} `json:"data"`
}

// NewBinanceConnector creates a new Binance WebSocket connector
func NewBinanceConnector(symbol string, logger *zap.Logger) *BinanceConnector {
	ctx, cancel := context.WithCancel(context.Background())
	return &BinanceConnector{
		symbol:         symbol,
		logger:         logger,
		ctx:            ctx,
		cancel:         cancel,
		messageChannel: make(chan []byte, 20000),
		errorChannel:   make(chan error, 100),
		closeChannel:   make(chan struct{}),
	}
}

// Connect establishes WebSocket connection to Binance
func (bc *BinanceConnector) Connect() error {
	bc.mu.Lock()
	defer bc.mu.Unlock()

	if bc.connected {
		return nil
	}

	// --- CORRECTED FUTURES WEBSOCKET URL ---
	// Using fstream.binance.com for USDⓈ-M Futures as per official documentation.
	// Using the /stream?streams=... format for combined streams is the correct syntax.
	baseWSURL := "wss://fstream.binance.com/stream?streams="
	streams := []string{
		fmt.Sprintf("%s@trade", bc.symbol),
		fmt.Sprintf("%s@depth@100ms", bc.symbol),
	}
	wsURL := baseWSURL + strings.Join(streams, "/")

	bc.logger.Info("Connecting to Binance Futures WebSocket",
		zap.String("symbol", bc.symbol),
		zap.String("url", wsURL),
	)

	// Set up WebSocket dialer with proper headers
	dialer := websocket.Dialer{
		Proxy:            http.ProxyFromEnvironment,
		HandshakeTimeout: 45 * time.Second,
		ReadBufferSize:   4096,
		WriteBufferSize:  4096,
	}

	// Add proper headers
	headers := http.Header{}
	headers.Set("User-Agent", "P9-MicroStream/1.0")

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		bc.reconnectCount++
		return fmt.Errorf("failed to connect to Binance WebSocket: %w", err)
	}

	bc.conn = conn
	bc.connected = true
	bc.lastPing = time.Now()

	// Set connection options
	bc.conn.SetReadLimit(655350) // 640KB
	bc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	bc.conn.SetPongHandler(func(string) error {
		bc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	bc.logger.Info("Successfully connected to Binance WebSocket",
		zap.String("symbol", bc.symbol),
	)

	return nil
}

// Start begins the WebSocket connection and message processing
func (bc *BinanceConnector) Start() error {
	if err := bc.Connect(); err != nil {
		return err
	}

	// Start message reading goroutine
	go bc.readMessages()

	// Start ping goroutine
	go bc.pingLoop()

	return nil
}

// readMessages reads messages from WebSocket connection
func (bc *BinanceConnector) readMessages() {
	defer func() {
		bc.mu.Lock()
		bc.connected = false
		if bc.conn != nil {
			bc.conn.Close()
		}
		bc.mu.Unlock()
		close(bc.closeChannel)
	}()

	for {
		select {
		case <-bc.ctx.Done():
			return
		default:
			messageType, message, err := bc.conn.ReadMessage()
			if err != nil {
				bc.logger.Error("WebSocket read error",
					zap.String("symbol", bc.symbol),
					zap.Error(err),
				)
				bc.errorChannel <- err
				return
			}

			if messageType == websocket.TextMessage {
				// Process and normalize the message
				if normalizedData, err := bc.processAndNormalizeMessage(message); err == nil {
					// Marshal the normalized data back to JSON to send through the channel
					if marshaledData, err := json.Marshal(normalizedData); err == nil {
						select {
						case bc.messageChannel <- marshaledData:
						default:
							bc.logger.Warn("Message channel full, dropping normalized message",
								zap.String("symbol", bc.symbol),
							)
						}
					} else {
						bc.logger.Error("Failed to marshal normalized data", zap.Error(err))
					}
				} else {
					bc.logger.Debug("Could not normalize message", zap.Error(err), zap.ByteString("raw_message", message))
				}
			}
		}
	}
}

// processAndNormalizeMessage processes incoming WebSocket messages and normalizes them.
func (bc *BinanceConnector) processAndNormalizeMessage(message []byte) (interface{}, error) {
	// Try to parse as trade data first
	var tradeData BinanceTradeData
	if err := json.Unmarshal(message, &tradeData); err == nil && tradeData.Data.EventType == "trade" {
		price, err := strconv.ParseFloat(tradeData.Data.Price, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse trade price: %w", err)
		}
		quantity, err := strconv.ParseFloat(tradeData.Data.Quantity, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse trade quantity: %w", err)
		}

		return StandardizedTrade{
			Type:      "trade",
			Exchange:  "binance",
			Symbol:    strings.ToLower(tradeData.Data.Symbol),
			Price:     price,
			Quantity:  quantity,
			Timestamp: tradeData.Data.TradeTime,
		}, nil
	}

	// Try to parse as depth data
	var depthData BinanceDepthData
	if err := json.Unmarshal(message, &depthData); err == nil && depthData.Data.EventType == "depthUpdate" {
		bids, err := convertStringPairsToFloat(depthData.Data.Bids)
		if err != nil {
			return nil, fmt.Errorf("failed to convert depth bids: %w", err)
		}
		asks, err := convertStringPairsToFloat(depthData.Data.Asks)
		if err != nil {
			return nil, fmt.Errorf("failed to convert depth asks: %w", err)
		}

		return StandardizedDepth{
			Type:      "depth",
			Exchange:  "binance",
			Symbol:    strings.ToLower(depthData.Data.Symbol),
			Timestamp: depthData.Data.EventTime,
			Bids:      bids,
			Asks:      asks,
		}, nil
	}

	return nil, fmt.Errorf("unrecognized message type")
}

// pingLoop sends periodic ping messages to keep connection alive
func (bc *BinanceConnector) pingLoop() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-bc.ctx.Done():
			return
		case <-ticker.C:
			bc.mu.RLock()
			if bc.connected && bc.conn != nil {
				if err := bc.conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					bc.logger.Error("Failed to send ping",
						zap.String("symbol", bc.symbol),
						zap.Error(err),
					)
				} else {
					bc.lastPing = time.Now()
					bc.logger.Debug("Sent ping",
						zap.String("symbol", bc.symbol),
					)
				}
			}
			bc.mu.RUnlock()
		}
	}
}

// ReadMessage reads a message from the message channel
func (bc *BinanceConnector) ReadMessage() ([]byte, error) {
	select {
	case message := <-bc.messageChannel:
		return message, nil
	case err := <-bc.errorChannel:
		return nil, err
	case <-bc.closeChannel:
		return nil, fmt.Errorf("connection closed")
	case <-bc.ctx.Done():
		return nil, bc.ctx.Err()
	}
}

// IsConnected returns the connection status
func (bc *BinanceConnector) IsConnected() bool {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return bc.connected
}

// GetReconnectCount returns the number of reconnection attempts
func (bc *BinanceConnector) GetReconnectCount() int {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return bc.reconnectCount
}

// Close closes the WebSocket connection
func (bc *BinanceConnector) Close() error {
	bc.cancel()

	bc.mu.Lock()
	defer bc.mu.Unlock()

	if bc.conn != nil {
		bc.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		bc.conn.Close()
		bc.conn = nil
	}

	bc.connected = false

	bc.logger.Info("Binance WebSocket connection closed",
		zap.String("symbol", bc.symbol),
	)

	return nil
}
