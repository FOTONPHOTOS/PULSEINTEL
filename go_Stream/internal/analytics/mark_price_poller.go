package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// MarkPricePoller polls mark prices from multiple exchanges
type MarkPricePoller struct {
	redisClient  *redis.Client
	httpClient   *http.Client
	pollInterval time.Duration
	symbols      []string
	exchanges    []string
	ctx          context.Context
	cancel       context.CancelFunc
}

// MarkPriceData represents mark price information
type MarkPriceData struct {
	Exchange   string    `json:"exchange"`
	Symbol     string    `json:"symbol"`
	MarkPrice  float64   `json:"mark_price"`
	IndexPrice float64   `json:"index_price,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

// Exchange-specific mark price response structures
type BinanceMarkPriceResponse struct {
	Symbol     string `json:"symbol"`
	MarkPrice  string `json:"markPrice"`
	IndexPrice string `json:"indexPrice,omitempty"`
	Time       int64  `json:"time"`
}

type BybitMarkPriceResponse struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		List []struct {
			Symbol     string `json:"symbol"`
			MarkPrice  string `json:"markPrice"`
			IndexPrice string `json:"indexPrice"`
		} `json:"list"`
	} `json:"result"`
}

type OKXMarkPriceResponse struct {
	Code interface{} `json:"code"` // Can be string or int
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"` // Can be array or object
}

// NewMarkPricePoller creates a new mark price poller
func NewMarkPricePoller(redisClient *redis.Client, pollInterval time.Duration, symbols []string) *MarkPricePoller {
	ctx, cancel := context.WithCancel(context.Background())

	// Normalize symbols for different exchanges
	exchanges := []string{"binance", "bybit", "okx"}

	return &MarkPricePoller{
		redisClient:  redisClient,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		pollInterval: pollInterval,
		symbols:      symbols,
		exchanges:    exchanges,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start begins the mark price polling
func (m *MarkPricePoller) Start() {
	log.Printf("🚀 Starting Mark Price Poller - polling every %v", m.pollInterval)

	// Initial fetch
	m.fetchAllMarkPrices()

	// Start polling ticker
	ticker := time.NewTicker(m.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.fetchAllMarkPrices()
		case <-m.ctx.Done():
			log.Println("📴 Mark Price Poller stopped")
			return
		}
	}
}

// Stop stops the mark price poller
func (m *MarkPricePoller) Stop() {
	m.cancel()
}

// fetchAllMarkPrices fetches mark prices from all exchanges
func (m *MarkPricePoller) fetchAllMarkPrices() {
	for _, exchange := range m.exchanges {
		for _, symbol := range m.symbols {
			go m.fetchMarkPrice(exchange, symbol)
		}
	}
}

// fetchMarkPrice fetches mark price for a specific exchange and symbol
func (m *MarkPricePoller) fetchMarkPrice(exchange, symbol string) {
	var markData *MarkPriceData
	var err error

	switch exchange {
	case "binance":
		markData, err = m.fetchBinanceMarkPrice(symbol)
	case "bybit":
		markData, err = m.fetchBybitMarkPrice(symbol)
	case "okx":
		markData, err = m.fetchOKXMarkPrice(symbol)
	default:
		log.Printf("❌ Unknown exchange: %s", exchange)
		return
	}

	if err != nil {
		log.Printf("❌ Error fetching mark price for %s:%s - %v", exchange, symbol, err)
		return
	}

	if markData != nil {
		m.publishMarkPrice(markData)
	}
}

// fetchBinanceMarkPrice fetches mark price from Binance
func (m *MarkPricePoller) fetchBinanceMarkPrice(symbol string) (*MarkPriceData, error) {
	// Convert symbol to Binance format (SOLUSDT)
	binanceSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=%s", binanceSymbol)

	resp, err := m.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var binanceResp BinanceMarkPriceResponse
	if err := json.NewDecoder(resp.Body).Decode(&binanceResp); err != nil {
		return nil, err
	}

	markPrice, err := parseFloat(binanceResp.MarkPrice)
	if err != nil {
		return nil, err
	}

	indexPrice, _ := parseFloat(binanceResp.IndexPrice)

	return &MarkPriceData{
		Exchange:   "binance",
		Symbol:     symbol,
		MarkPrice:  markPrice,
		IndexPrice: indexPrice,
		Timestamp:  time.Now(),
	}, nil
}

// fetchBybitMarkPrice fetches mark price from Bybit
func (m *MarkPricePoller) fetchBybitMarkPrice(symbol string) (*MarkPriceData, error) {
	// Convert symbol to Bybit format (SOLUSDT)
	bybitSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	url := fmt.Sprintf("https://api.bybit.com/v5/market/tickers?category=linear&symbol=%s", bybitSymbol)

	resp, err := m.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bybitResp BybitMarkPriceResponse
	if err := json.NewDecoder(resp.Body).Decode(&bybitResp); err != nil {
		return nil, err
	}

	if bybitResp.RetCode != 0 || len(bybitResp.Result.List) == 0 {
		return nil, fmt.Errorf("bybit API error: %s", bybitResp.RetMsg)
	}

	data := bybitResp.Result.List[0]
	markPrice, err := parseFloat(data.MarkPrice)
	if err != nil {
		return nil, err
	}

	indexPrice, _ := parseFloat(data.IndexPrice)

	return &MarkPriceData{
		Exchange:   "bybit",
		Symbol:     symbol,
		MarkPrice:  markPrice,
		IndexPrice: indexPrice,
		Timestamp:  time.Now(),
	}, nil
}

// fetchOKXMarkPrice fetches mark price from OKX
func (m *MarkPricePoller) fetchOKXMarkPrice(symbol string) (*MarkPriceData, error) {
	// Convert symbol to OKX format (e.g., SOL-USDT-SWAP)
	var okxSymbol string
	upperSymbol := strings.ToUpper(symbol)
	if strings.Contains(upperSymbol, "-") {
		okxSymbol = upperSymbol
	} else {
		// Convert SOLUSDT to SOL-USDT
		okxSymbol = strings.Replace(upperSymbol, "USDT", "-USDT", 1)
	}
	// OKX mark price for perpetuals requires the -SWAP suffix
	if !strings.HasSuffix(okxSymbol, "-SWAP") {
		okxSymbol += "-SWAP"
	}

	// CRITICAL FIX: The endpoint was incorrect. 'market' is for authenticated users.
	// The correct public endpoint is 'public'.
	url := fmt.Sprintf("https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=%s", okxSymbol)

	resp, err := m.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var okxResp OKXMarkPriceResponse
	if err := json.NewDecoder(resp.Body).Decode(&okxResp); err != nil {
		return nil, err
	}

	// Check code (can be string "0" or int 0)
	codeStr := fmt.Sprintf("%v", okxResp.Code)
	if codeStr != "0" {
		return nil, fmt.Errorf("okx API error: %s", okxResp.Msg)
	}

	// Parse data (can be array or object)
	var markPx, idxPx string

	// Try to parse as array first
	if dataArray, ok := okxResp.Data.([]interface{}); ok && len(dataArray) > 0 {
		if dataObj, ok := dataArray[0].(map[string]interface{}); ok {
			markPx, _ = dataObj["markPx"].(string)
			idxPx, _ = dataObj["idxPx"].(string)
		}
	} else if dataObj, ok := okxResp.Data.(map[string]interface{}); ok {
		// Single object response
		markPx, _ = dataObj["markPx"].(string)
		idxPx, _ = dataObj["idxPx"].(string)
	}

	if markPx == "" {
		return nil, fmt.Errorf("okx API: no mark price data found")
	}

	markPrice, err := parseFloat(markPx)
	if err != nil {
		return nil, err
	}

	indexPrice, _ := parseFloat(idxPx)

	return &MarkPriceData{
		Exchange:   "okx",
		Symbol:     symbol,
		MarkPrice:  markPrice,
		IndexPrice: indexPrice,
		Timestamp:  time.Now(),
	}, nil
}

// publishMarkPrice publishes mark price data to Redis
func (m *MarkPricePoller) publishMarkPrice(data *MarkPriceData) {
	// Channel format: meta:mark_price:{exchange}:{symbol}
	channel := fmt.Sprintf("meta:mark_price:%s:%s", data.Exchange, data.Symbol)

	// Serialize data
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("❌ Error marshaling mark price data: %v", err)
		return
	}

	// Publish to Redis
	if err := m.redisClient.Publish(m.ctx, channel, payload).Err(); err != nil {
		log.Printf("❌ Error publishing mark price to Redis: %v", err)
		return
	}

	log.Printf("💰 Published mark price: %s | Mark: $%.4f | Index: $%.4f",
		channel,
		data.MarkPrice,
		data.IndexPrice)
}
