package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"pulseintel/internal/analytics"
	"pulseintel/internal/config"
	"pulseintel/internal/exchanges"
	"pulseintel/internal/supervisor"
	"pulseintel/pkg/broadcaster"
)

// P9MicroStream represents the main application - REAL MARKET DATA PIPELINE

// P9MicroStream represents the main application - REAL MARKET DATA PIPELINE
type P9MicroStream struct {
	config      *config.Config
	logger      *zap.Logger
	supervisor  *supervisor.Supervisor
	broadcaster *broadcaster.Broadcaster

	ctx    context.Context
	cancel context.CancelFunc
}

func main() {
	fmt.Println("🚀 P9-MicroStream - INSTITUTIONAL MARKET DATA PIPELINE")
	fmt.Println("📡 WebSocket → Internal Broadcaster → Python Backend")
	fmt.Println("🔥 REAL DATA ONLY - NO FAKE DATA")

	app := &P9MicroStream{}

	// Initialize application
	if err := app.initialize(); err != nil {
		fmt.Printf("❌ Failed to initialize P9-MicroStream: %v\n", err)
		os.Exit(1)
	}

	// Start services
	if err := app.start(); err != nil {
		fmt.Printf("❌ Failed to start P9-MicroStream: %v\n", err)
		os.Exit(1)
	}

	// Wait for shutdown signal
	app.waitForShutdown()

	// Graceful shutdown
	if err := app.shutdown(); err != nil {
		fmt.Printf("❌ Error during shutdown: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ P9-MicroStream stopped gracefully")
}

// initialize sets up all components
func (app *P9MicroStream) initialize() error {
	var err error

	// Setup context
	app.ctx, app.cancel = context.WithCancel(context.Background())

	// Initialize logger
	app.logger, err = app.setupLogger()
	if err != nil {
		return fmt.Errorf("failed to setup logger: %w", err)
	}

	app.logger.Info("🔧 Initializing P9-MicroStream - REAL MARKET DATA PIPELINE")

	// Load configuration - Use Render-optimized config
	execPath, _ := os.Executable()
	execDir := filepath.Dir(execPath)
	
	// Try Render config first, fallback to default
	configPath := filepath.Join(execDir, "configs", "config_render.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = filepath.Join(execDir, "configs", "config.yaml")
	}

	configLoader := config.NewConfigLoader()
	app.config, err = configLoader.LoadConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	app.logger.Info("✅ Configuration loaded",
		zap.Int("exchanges", len(app.config.Exchanges)),
	)

	// Initialize WebSocket broadcaster
	app.broadcaster = broadcaster.NewBroadcaster(app.logger)

	// Initialize supervisor
	app.supervisor = supervisor.NewSupervisor(app.logger)

	app.logger.Info("✅ Core components initialized")
	return nil
}

func (app *P9MicroStream) setupLogger() (*zap.Logger, error) {
	config := zap.NewProductionConfig()
	config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	config.OutputPaths = []string{"stdout"}
	return config.Build()
}

// start starts the application
func (app *P9MicroStream) start() error {
	app.logger.Info("🚀 Starting P9-MicroStream - REAL MARKET DATA PIPELINE")

	// Start the WebSocket broadcaster
	go app.broadcaster.Run()

	// Start the internal WebSocket server
	go app.startWebSocketServer()

	// Register WebSocket workers
	if err := app.registerWebSocketWorkers(); err != nil {
		return fmt.Errorf("failed to register WebSocket workers: %w", err)
	}

	// Start supervisor
	if err := app.supervisor.Start(); err != nil {
		return fmt.Errorf("failed to start supervisor: %w", err)
	}

	app.printStartupSummary()
	return nil
}

func (app *P9MicroStream) startWebSocketServer() {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Allow all connections for now, can be restricted later
			return true
		},
		// Enable standard WebSocket compression
		EnableCompression: true,
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			app.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
			return
		}
		
		// Register the client with the broadcaster
		app.broadcaster.Register(conn)

		// When this handler exits (e.g., due to client disconnect), ensure the client is unregistered.
		// The broadcaster is responsible for closing the connection itself.
		defer app.broadcaster.Unregister(conn)

		for {
			// Block by reading messages from the client. This is the standard way
			// to keep the connection alive and to detect when the client closes it.
			if _, _, err := conn.ReadMessage(); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					app.logger.Warn("WebSocket client disconnected unexpectedly", zap.String("remoteAddr", conn.RemoteAddr().String()), zap.Error(err))
				} else {
					app.logger.Info("WebSocket client disconnected", zap.String("remoteAddr", conn.RemoteAddr().String()))
				}
				// When ReadMessage returns an error, it means the connection is dead.
				// The loop will break, and the deferred Unregister call will be executed.
				break
			}
		}
	}

	http.HandleFunc("/ws", handler)
	
	// Add health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "healthy",
			"service": "pulseintel-go-engine",
			"version": "1.0.0",
			"uptime":  time.Since(time.Now()).String(),
		})
	})
	
	app.logger.Info("🔌 Starting internal WebSocket server on :8899")
	app.logger.Info("🏥 Health check available at :8899/health")
	if err := http.ListenAndServe(":8899", nil); err != nil {
		app.logger.Fatal("Internal WebSocket server failed", zap.Error(err))
	}
}

// registerWebSocketWorkers registers ONLY real WebSocket workers
func (app *P9MicroStream) registerWebSocketWorkers() error {
	var workerCount int
	for _, exchangeConfig := range app.config.Exchanges {
		if !exchangeConfig.Enabled {
			continue
		}

		for _, symbol := range exchangeConfig.Symbols {
			normSymbol := analytics.NormalizeSymbol(symbol)
			workerName := fmt.Sprintf("%s-%s-websocket", exchangeConfig.Name, normSymbol)

			workerFunc := app.createWebSocketWorker(exchangeConfig, normSymbol)

			workerConfig := supervisor.WorkerConfig{
				Name:           workerName,
				Exchange:       exchangeConfig.Name,
				Symbol:         normSymbol,
				MaxRetries:     10,
				InitialBackoff: 5 * time.Second,
				MaxBackoff:     60 * time.Second,
				BackoffFactor:  2.0,
			}

			app.supervisor.AddWorker(workerConfig, workerFunc)
			app.logger.Info("📡 Registered WebSocket worker",
				zap.String("exchange", exchangeConfig.Name),
				zap.String("symbol", normSymbol),
				zap.String("ws_url", exchangeConfig.WebSocketURL))

			workerCount++
		}
	}
	app.logger.Info("✅ WebSocket workers registered", zap.Int("count", workerCount))
	return nil
}

// createWebSocketWorker creates a WebSocket worker for an exchange/symbol
func (app *P9MicroStream) createWebSocketWorker(exchangeConfig config.ExchangeConfig, symbol string) supervisor.WorkerFunc {
	return func(ctx context.Context) error {
		logger := app.logger.With(
			zap.String("exchange", exchangeConfig.Name),
			zap.String("symbol", symbol),
		)

		logger.Info("🔗 Starting WebSocket worker")

		for {
			select {
			case <-ctx.Done():
				logger.Info("WebSocket worker stopped")
				return nil
			default:
				var err error
				switch exchangeConfig.Name {
				case "binance":
					err = app.runBinanceWorker(ctx, exchangeConfig, symbol, logger)
				case "bybit":
					err = app.runBybitWorker(ctx, exchangeConfig, symbol, logger)
				case "okx":
					err = app.runOKXWorker(ctx, exchangeConfig, symbol, logger)
				case "hyperliquid":
					err = app.runHyperliquidWorker(ctx, exchangeConfig, symbol, logger)
				case "mexc":
					err = app.runMexcWorker(ctx, exchangeConfig, symbol, logger)
				default:
					err = fmt.Errorf("unsupported exchange: %s", exchangeConfig.Name)
				}

				if err != nil {
					logger.Error("WebSocket worker error", zap.Error(err))
				}

				// Wait before reconnecting
				select {
				case <-ctx.Done():
					return nil
				case <-time.After(5 * time.Second):
					logger.Info("Reconnecting WebSocket...")
				}
			}
		}
	}
}

// runBinanceWorker runs Binance WebSocket worker - REAL DATA ONLY
func (app *P9MicroStream) runBinanceWorker(ctx context.Context, _ config.ExchangeConfig, symbol string, logger *zap.Logger) error {
	connector := exchanges.NewBinanceConnector(symbol, logger)

	if err := connector.Start(); err != nil {
		return fmt.Errorf("failed to start Binance connector: %w", err)
	}
	defer connector.Close()

	logger.Info("✅ Binance WebSocket connected", zap.String("symbol", symbol))

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			message, err := connector.ReadMessage()
			if err != nil {
				return fmt.Errorf("failed to read message: %w", err)
			}
			app.processAndBroadcastMessage("binance", symbol, message)
		}
	}
}

// runBybitWorker runs Bybit WebSocket worker - REAL DATA ONLY
func (app *P9MicroStream) runBybitWorker(ctx context.Context, exchangeConfig config.ExchangeConfig, symbol string, logger *zap.Logger) error {
	connector := exchanges.NewBybitConnector(symbol, logger, exchangeConfig.WebSocketURL)

	if err := connector.Start(); err != nil {
		return fmt.Errorf("failed to start Bybit connector: %w", err)
	}
	defer connector.Close()

	logger.Info("✅ Bybit WebSocket connected", zap.String("symbol", symbol))

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			message, err := connector.ReadMessage()
			if err != nil {
				return fmt.Errorf("failed to read message: %w", err)
			}
			app.processAndBroadcastMessage("bybit", symbol, message)
		}
	}
}

// runOKXWorker runs OKX WebSocket worker - REAL DATA ONLY
func (app *P9MicroStream) runOKXWorker(ctx context.Context, exchangeConfig config.ExchangeConfig, symbol string, logger *zap.Logger) error {
	okxConfig := exchanges.OKXConfig{
		Endpoint:       exchangeConfig.WebSocketURL,
		Symbols:        []string{symbol},
		ReconnectDelay: 5 * time.Second,
		MaxReconnects:  10,
		PingInterval:   30 * time.Second,
		WriteWait:      10 * time.Second,
		ReadWait:       60 * time.Second,
		MaxMessageSize: 512 * 1024,
	}

	connector := exchanges.NewOKXConnector(okxConfig, logger)

	if err := connector.Connect(symbol); err != nil {
		return fmt.Errorf("failed to connect to OKX: %w", err)
	}
	defer connector.Close()

	logger.Info("✅ OKX WebSocket connected", zap.String("symbol", symbol))

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			message, err := connector.ReadMessage()
			if err != nil {
				logger.Error("Failed to read OKX message", zap.Error(err))
				if err := connector.Reconnect(symbol); err != nil {
					return fmt.Errorf("failed to reconnect to OKX: %w", err)
				}
				continue
			}
			app.processAndBroadcastMessage("okx", symbol, message)
		}
	}
}

// runHyperliquidWorker runs Hyperliquid WebSocket worker - REAL DATA ONLY
func (app *P9MicroStream) runHyperliquidWorker(ctx context.Context, _ config.ExchangeConfig, symbol string, logger *zap.Logger) error {
	connector := exchanges.NewHyperliquidConnector(symbol, logger)

	if err := connector.Start(); err != nil {
		return fmt.Errorf("failed to start Hyperliquid connector: %w", err)
	}
	defer connector.Close()

	logger.Info("✅ Hyperliquid WebSocket connected", zap.String("symbol", symbol))

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			message, err := connector.ReadMessage()
			if err != nil {
				return fmt.Errorf("failed to read message: %w", err)
			}
			app.processAndBroadcastMessage("hyperliquid", symbol, message)
		}
	}
}

// runMexcWorker runs Mexc WebSocket worker - REAL DATA ONLY
func (app *P9MicroStream) runMexcWorker(ctx context.Context, _ config.ExchangeConfig, symbol string, logger *zap.Logger) error {
	// TODO: Implement Mexc connector and its logic
	logger.Info("Mexc worker not yet implemented", zap.String("symbol", symbol))
	return nil // Placeholder
}

// processAndBroadcastMessage unifies message processing and broadcasts to internal WebSocket clients
func (app *P9MicroStream) processAndBroadcastMessage(exchange, symbol string, message []byte) {
	// First try to normalize the message based on exchange
	normalizedData, err := app.normalizeMessage(exchange, symbol, message)
	if err != nil {
		// If normalization fails, log and send raw message with metadata
		app.logger.Debug("Failed to normalize message, sending raw", 
			zap.String("exchange", exchange), 
			zap.String("symbol", symbol), 
			zap.Error(err))
		
		var payload map[string]interface{}
		if err := json.Unmarshal(message, &payload); err != nil {
			payload = map[string]interface{}{"raw": string(message)}
		}
		
		// Add standardized metadata
		payload["exchange"] = exchange
		payload["symbol"] = symbol
		payload["received_at"] = time.Now().UnixMilli()
		
		finalPayload, err := json.Marshal(payload)
		if err != nil {
			app.logger.Error("Failed to marshal final payload", zap.Error(err))
			return
		}
		
		app.broadcaster.Broadcast(finalPayload)
		return
	}

	// If normalization succeeded, broadcast the normalized data
	finalPayload, err := json.Marshal(normalizedData)
	if err != nil {
		app.logger.Error("Failed to marshal normalized payload", zap.Error(err))
		return
	}

	app.broadcaster.Broadcast(finalPayload)
}

// normalizeMessage normalizes messages from different exchanges into a standard format
func (app *P9MicroStream) normalizeMessage(exchange, symbol string, message []byte) (interface{}, error) {
	switch exchange {
	case "binance":
		return app.normalizeBinanceMessage(symbol, message)
	case "bybit":
		return app.normalizeBybitMessage(symbol, message)
	case "okx":
		return app.normalizeOKXMessage(symbol, message)
	case "hyperliquid":
		return app.normalizeHyperliquidMessage(symbol, message)
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", exchange)
	}
}

// normalizeBinanceMessage normalizes Binance messages (already normalized in connector)
func (app *P9MicroStream) normalizeBinanceMessage(symbol string, message []byte) (interface{}, error) {
	// Binance messages are already normalized by the connector
	var data map[string]interface{}
	if err := json.Unmarshal(message, &data); err != nil {
		return nil, err
	}
	
	// Add received_at timestamp
	data["received_at"] = time.Now().UnixMilli()
	return data, nil
}

// normalizeBybitMessage normalizes Bybit messages
func (app *P9MicroStream) normalizeBybitMessage(symbol string, message []byte) (interface{}, error) {
	// Parse the raw Bybit message
	var bybitMsg struct {
		Topic string          `json:"topic"`
		Type  string          `json:"type"`
		TS    int64           `json:"ts"`
		Data  json.RawMessage `json:"data"`
		CTS   int64           `json:"cts"`
	}
	
	if err := json.Unmarshal(message, &bybitMsg); err != nil {
		return nil, fmt.Errorf("failed to parse Bybit message: %w", err)
	}

	// Handle different message types
	if strings.HasPrefix(bybitMsg.Topic, "publicTrade.") {
		return app.normalizeBybitTrade(symbol, bybitMsg)
	} else if strings.HasPrefix(bybitMsg.Topic, "orderbook.") {
		return app.normalizeBybitOrderbook(symbol, bybitMsg)
	} else if strings.HasPrefix(bybitMsg.Topic, "kline.") {
		return app.normalizeBybitKline(symbol, bybitMsg)
	}
	
	return nil, fmt.Errorf("unsupported Bybit message type: %s", bybitMsg.Topic)
}

// normalizeBybitTrade normalizes Bybit trade messages
func (app *P9MicroStream) normalizeBybitTrade(symbol string, msg struct {
	Topic string          `json:"topic"`
	Type  string          `json:"type"`
	TS    int64           `json:"ts"`
	Data  json.RawMessage `json:"data"`
	CTS   int64           `json:"cts"`
}) (interface{}, error) {
	var trades []struct {
		ExecID       string `json:"i"`
		Symbol       string `json:"s"`
		Price        string `json:"p"`
		Size         string `json:"v"`
		Side         string `json:"S"`
		Time         int64  `json:"T"`
		IsBlockTrade bool   `json:"BT"`
	}
	
	if err := json.Unmarshal(msg.Data, &trades); err != nil {
		return nil, fmt.Errorf("failed to parse Bybit trade data: %w", err)
	}
	
	if len(trades) == 0 {
		return nil, fmt.Errorf("empty trade data")
	}
	
	trade := trades[0]
	price, _ := strconv.ParseFloat(trade.Price, 64)
	quantity, _ := strconv.ParseFloat(trade.Size, 64)
	
	return map[string]interface{}{
		"type":        "trade",
		"exchange":    "bybit",
		"symbol":      strings.ToLower(trade.Symbol),
		"price":       price,
		"quantity":    quantity,
		"side":        strings.ToLower(trade.Side),
		"timestamp":   trade.Time,
		"received_at": time.Now().UnixMilli(),
	}, nil
}

// normalizeBybitOrderbook normalizes Bybit orderbook messages
func (app *P9MicroStream) normalizeBybitOrderbook(symbol string, msg struct {
	Topic string          `json:"topic"`
	Type  string          `json:"type"`
	TS    int64           `json:"ts"`
	Data  json.RawMessage `json:"data"`
	CTS   int64           `json:"cts"`
}) (interface{}, error) {
	var orderbook struct {
		Symbol   string     `json:"s"`
		Bids     [][]string `json:"b"`
		Asks     [][]string `json:"a"`
		UpdateID int64      `json:"u"`
		Seq      int64      `json:"seq"`
	}
	
	if err := json.Unmarshal(msg.Data, &orderbook); err != nil {
		return nil, fmt.Errorf("failed to parse Bybit orderbook data: %w", err)
	}
	
	// Convert string arrays to float arrays
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
	
	return map[string]interface{}{
		"type":        "depth",
		"exchange":    "bybit",
		"symbol":      strings.ToLower(orderbook.Symbol),
		"bids":        bids,
		"asks":        asks,
		"timestamp":   msg.TS,
		"received_at": time.Now().UnixMilli(),
	}, nil
}

// normalizeBybitKline normalizes Bybit kline/candle messages
func (app *P9MicroStream) normalizeBybitKline(symbol string, msg struct {
	Topic string          `json:"topic"`
	Type  string          `json:"type"`
	TS    int64           `json:"ts"`
	Data  json.RawMessage `json:"data"`
	CTS   int64           `json:"cts"`
}) (interface{}, error) {
	var klines []struct {
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
	
	if err := json.Unmarshal(msg.Data, &klines); err != nil {
		return nil, fmt.Errorf("failed to parse Bybit kline data: %w", err)
	}
	
	if len(klines) == 0 {
		return nil, fmt.Errorf("empty kline data")
	}
	
	kline := klines[0]
	open, _ := strconv.ParseFloat(kline.Open, 64)
	high, _ := strconv.ParseFloat(kline.High, 64)
	low, _ := strconv.ParseFloat(kline.Low, 64)
	close_, _ := strconv.ParseFloat(kline.Close, 64)
	volume, _ := strconv.ParseFloat(kline.Volume, 64)
	
	return map[string]interface{}{
		"type":        "candle",
		"exchange":    "bybit",
		"symbol":      strings.ToLower(symbol),
		"interval":    kline.Interval,
		"open":        open,
		"high":        high,
		"low":         low,
		"close":       close_,
		"volume":      volume,
		"timestamp":   kline.Start,
		"confirmed":   kline.Confirmed,
		"received_at": time.Now().UnixMilli(),
	}, nil
}

// normalizeOKXMessage normalizes OKX messages
func (app *P9MicroStream) normalizeOKXMessage(symbol string, message []byte) (interface{}, error) {
	var okxMsg struct {
		Arg struct {
			Channel string `json:"channel"`
			InstID  string `json:"instId"`
		} `json:"arg"`
		Data []json.RawMessage `json:"data"`
	}
	
	if err := json.Unmarshal(message, &okxMsg); err != nil {
		return nil, fmt.Errorf("failed to parse OKX message: %w", err)
	}
	
	if len(okxMsg.Data) == 0 {
		return nil, fmt.Errorf("empty OKX data array")
	}
	
	// Handle different channel types
	switch okxMsg.Arg.Channel {
	case "trades":
		return app.normalizeOKXTrade(symbol, okxMsg.Data[0])
	case "books":
		return app.normalizeOKXOrderbook(symbol, okxMsg.Data[0])
	default:
		return nil, fmt.Errorf("unsupported OKX channel: %s", okxMsg.Arg.Channel)
	}
}

// normalizeOKXTrade normalizes OKX trade messages
func (app *P9MicroStream) normalizeOKXTrade(symbol string, data json.RawMessage) (interface{}, error) {
	var trade struct {
		InstID    string `json:"instId"`
		TradeID   string `json:"tradeId"`
		Price     string `json:"px"`
		Size      string `json:"sz"`
		Side      string `json:"side"`
		Timestamp string `json:"ts"`
	}
	
	if err := json.Unmarshal(data, &trade); err != nil {
		return nil, fmt.Errorf("failed to parse OKX trade: %w", err)
	}
	
	price, _ := strconv.ParseFloat(trade.Price, 64)
	quantity, _ := strconv.ParseFloat(trade.Size, 64)
	timestamp, _ := strconv.ParseInt(trade.Timestamp, 10, 64)
	
	return map[string]interface{}{
		"type":        "trade",
		"exchange":    "okx",
		"symbol":      strings.ToLower(symbol),
		"price":       price,
		"quantity":    quantity,
		"side":        trade.Side,
		"timestamp":   timestamp,
		"received_at": time.Now().UnixMilli(),
	}, nil
}

// normalizeOKXOrderbook normalizes OKX orderbook messages
func (app *P9MicroStream) normalizeOKXOrderbook(symbol string, data json.RawMessage) (interface{}, error) {
	var orderbook struct {
		InstID    string     `json:"instId"`
		Bids      [][]string `json:"bids"`
		Asks      [][]string `json:"asks"`
		Timestamp string     `json:"ts"`
		Checksum  int        `json:"checksum"`
	}
	
	if err := json.Unmarshal(data, &orderbook); err != nil {
		return nil, fmt.Errorf("failed to parse OKX orderbook: %w", err)
	}
	
	// Convert string arrays to float arrays
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
	
	timestamp, _ := strconv.ParseInt(orderbook.Timestamp, 10, 64)
	
	return map[string]interface{}{
		"type":        "depth",
		"exchange":    "okx",
		"symbol":      strings.ToLower(symbol),
		"bids":        bids,
		"asks":        asks,
		"timestamp":   timestamp,
		"received_at": time.Now().UnixMilli(),
	}, nil
}

// normalizeHyperliquidMessage normalizes Hyperliquid messages
func (app *P9MicroStream) normalizeHyperliquidMessage(symbol string, message []byte) (interface{}, error) {
	// Basic Hyperliquid message parsing - this needs to be expanded based on their API
	var data map[string]interface{}
	if err := json.Unmarshal(message, &data); err != nil {
		return nil, fmt.Errorf("failed to parse Hyperliquid message: %w", err)
	}
	
	// Add metadata and return (placeholder implementation)
	data["exchange"] = "hyperliquid"
	data["symbol"] = strings.ToLower(symbol)
	data["received_at"] = time.Now().UnixMilli()
	
	return data, nil
}

func (app *P9MicroStream) printStartupSummary() {
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("🎉 P9-MICROSTREAM SUCCESSFULLY STARTED - REAL DATA ONLY")
	fmt.Println(strings.Repeat("=", 80))

	workerCount := 0
	for _, exchange := range app.config.Exchanges {
		if exchange.Enabled {
			workerCount += len(exchange.Symbols)
		}
	}

	fmt.Printf("📊 Total WebSocket Workers: %d\n", workerCount)
	fmt.Printf("🔗 Internal Broadcaster: ACTIVE on ws://localhost:8899/ws\n")
	fmt.Printf("🚀 System Status: OPERATIONAL - ZERO FAKE DATA\n")
	fmt.Println(strings.Repeat("=", 80))
}

func (app *P9MicroStream) waitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigChan
	app.logger.Info("Received shutdown signal", zap.String("signal", sig.String()))
}

func (app *P9MicroStream) shutdown() error {
	app.logger.Info("🛑 Shutting down P9-MicroStream...")

	// Cancel context to stop all workers
	app.cancel()

	// Stop supervisor
	if err := app.supervisor.Stop(); err != nil {
		app.logger.Error("Error stopping supervisor", zap.Error(err))
	}

	app.logger.Info("✅ P9-MicroStream shutdown complete")
	return nil
}
