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

// OpenInterestPoller polls open interest data from multiple exchanges
type OpenInterestPoller struct {
	redisClient  *redis.Client
	httpClient   *http.Client
	pollInterval time.Duration
	symbols      []string
	exchanges    []string
	ctx          context.Context
	cancel       context.CancelFunc
}

// OpenInterestData represents open interest information
type OpenInterestData struct {
	Exchange     string    `json:"exchange"`
	Symbol       string    `json:"symbol"`
	OpenInterest float64   `json:"open_interest"`
	OpenValue    float64   `json:"open_value,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
}

// Exchange-specific open interest response structures
type BinanceOpenInterestResponse struct {
	Symbol       string `json:"symbol"`
	OpenInterest string `json:"openInterest"`
	Time         int64  `json:"time"`
}

type BybitOpenInterestResponse struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		List []struct {
			Symbol       string `json:"symbol"`
			OpenInterest string `json:"openInterest"`
			Timestamp    string `json:"timestamp"`
		} `json:"list"`
	} `json:"result"`
}

type OKXOpenInterestResponse struct {
	Code interface{} `json:"code"` // Can be string or int
	Msg  string      `json:"msg"`
	Data []struct {
		InstType string `json:"instType"`
		InstId   string `json:"instId"`
		Oi       string `json:"oi"`
		OiCcy    string `json:"oiCcy"`
		Ts       string `json:"ts"`
	} `json:"data"`
}

// NewOpenInterestPoller creates a new open interest poller
func NewOpenInterestPoller(redisClient *redis.Client, pollInterval time.Duration, symbols []string) *OpenInterestPoller {
	ctx, cancel := context.WithCancel(context.Background())

	// Normalize symbols for different exchanges
	exchanges := []string{"binance", "bybit", "okx"}

	return &OpenInterestPoller{
		redisClient:  redisClient,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		pollInterval: pollInterval,
		symbols:      symbols,
		exchanges:    exchanges,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start begins the open interest polling
func (o *OpenInterestPoller) Start() {
	log.Printf("🚀 Starting Open Interest Poller - polling every %v", o.pollInterval)

	// Initial fetch
	o.fetchAllOpenInterest()

	// Start polling ticker
	ticker := time.NewTicker(o.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			o.fetchAllOpenInterest()
		case <-o.ctx.Done():
			log.Println("📴 Open Interest Poller stopped")
			return
		}
	}
}

// Stop stops the open interest poller
func (o *OpenInterestPoller) Stop() {
	o.cancel()
}

// fetchAllOpenInterest fetches open interest from all exchanges
func (o *OpenInterestPoller) fetchAllOpenInterest() {
	for _, exchange := range o.exchanges {
		for _, symbol := range o.symbols {
			go o.fetchOpenInterest(exchange, symbol)
		}
	}
}

// fetchOpenInterest fetches open interest for a specific exchange and symbol
func (o *OpenInterestPoller) fetchOpenInterest(exchange, symbol string) {
	var oiData *OpenInterestData
	var err error

	switch exchange {
	case "binance":
		oiData, err = o.fetchBinanceOpenInterest(symbol)
	case "bybit":
		oiData, err = o.fetchBybitOpenInterest(symbol)
	case "okx":
		oiData, err = o.fetchOKXOpenInterest(symbol)
	default:
		log.Printf("❌ Unknown exchange: %s", exchange)
		return
	}

	if err != nil {
		log.Printf("❌ Error fetching open interest for %s:%s - %v", exchange, symbol, err)
		return
	}

	if oiData != nil {
		o.publishOpenInterest(oiData)
	}
}

// fetchBinanceOpenInterest fetches open interest from Binance
func (o *OpenInterestPoller) fetchBinanceOpenInterest(symbol string) (*OpenInterestData, error) {
	// Convert symbol to Binance format (SOLUSDT)
	binanceSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/openInterest?symbol=%s", binanceSymbol)

	resp, err := o.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var binanceResp BinanceOpenInterestResponse
	if err := json.NewDecoder(resp.Body).Decode(&binanceResp); err != nil {
		return nil, err
	}

	openInterest, err := parseFloat(binanceResp.OpenInterest)
	if err != nil {
		return nil, err
	}

	return &OpenInterestData{
		Exchange:     "binance",
		Symbol:       symbol,
		OpenInterest: openInterest,
		Timestamp:    time.Now(),
	}, nil
}

// fetchBybitOpenInterest fetches open interest from Bybit
func (o *OpenInterestPoller) fetchBybitOpenInterest(symbol string) (*OpenInterestData, error) {
	// Convert symbol to Bybit format (SOLUSDT)
	bybitSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	// Bybit requires intervalTime parameter - using 5m as default
	url := fmt.Sprintf("https://api.bybit.com/v5/market/open-interest?category=linear&symbol=%s&intervalTime=5min", bybitSymbol)

	resp, err := o.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bybitResp BybitOpenInterestResponse
	if err := json.NewDecoder(resp.Body).Decode(&bybitResp); err != nil {
		return nil, err
	}

	if bybitResp.RetCode != 0 || len(bybitResp.Result.List) == 0 {
		return nil, fmt.Errorf("bybit API error: %s", bybitResp.RetMsg)
	}

	data := bybitResp.Result.List[0]
	openInterest, err := parseFloat(data.OpenInterest)
	if err != nil {
		return nil, err
	}

	return &OpenInterestData{
		Exchange:     "bybit",
		Symbol:       symbol,
		OpenInterest: openInterest,
		Timestamp:    time.Now(),
	}, nil
}

// fetchOKXOpenInterest fetches open interest from OKX
func (o *OpenInterestPoller) fetchOKXOpenInterest(symbol string) (*OpenInterestData, error) {
	// Convert symbol to OKX format (SOL-USDT-SWAP)
	var okxSymbol string
	if strings.Contains(symbol, "-") {
		okxSymbol = strings.ToUpper(symbol) + "-SWAP"
	} else {
		// Convert SOLUSDT to SOL-USDT-SWAP
		if symbol == "solusdt" {
			okxSymbol = "SOL-USDT-SWAP"
		} else {
			okxSymbol = strings.ToUpper(symbol) + "-SWAP"
		}
	}

	url := fmt.Sprintf("https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=%s", okxSymbol)

	resp, err := o.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var okxResp OKXOpenInterestResponse
	if err := json.NewDecoder(resp.Body).Decode(&okxResp); err != nil {
		return nil, err
	}

	// Check code (can be string "0" or int 0)
	codeStr := fmt.Sprintf("%v", okxResp.Code)
	if codeStr != "0" || len(okxResp.Data) == 0 {
		return nil, fmt.Errorf("okx API error: %s", okxResp.Msg)
	}

	data := okxResp.Data[0]
	openInterest, err := parseFloat(data.Oi)
	if err != nil {
		return nil, err
	}

	openValue, _ := parseFloat(data.OiCcy)

	return &OpenInterestData{
		Exchange:     "okx",
		Symbol:       symbol,
		OpenInterest: openInterest,
		OpenValue:    openValue,
		Timestamp:    time.Now(),
	}, nil
}

// publishOpenInterest publishes open interest data to Redis
func (o *OpenInterestPoller) publishOpenInterest(data *OpenInterestData) {
	// Channel format: meta:oi:{exchange}:{symbol}
	channel := fmt.Sprintf("meta:oi:%s:%s", data.Exchange, data.Symbol)

	// Serialize data
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("❌ Error marshaling open interest data: %v", err)
		return
	}

	// Publish to Redis
	if err := o.redisClient.Publish(o.ctx, channel, payload).Err(); err != nil {
		log.Printf("❌ Error publishing open interest to Redis: %v", err)
		return
	}

	log.Printf("📊 Published open interest: %s | OI: %.2f | Value: $%.2f",
		channel,
		data.OpenInterest,
		data.OpenValue)
}
