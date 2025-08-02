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

// FundingRateAggregator polls funding rates from multiple exchanges
type FundingRateAggregator struct {
	redisClient  *redis.Client
	httpClient   *http.Client
	pollInterval time.Duration
	symbols      []string
	exchanges    []string
	ctx          context.Context
	cancel       context.CancelFunc
}

// FundingRateData represents funding rate information
type FundingRateData struct {
	Exchange        string    `json:"exchange"`
	Symbol          string    `json:"symbol"`
	FundingRate     float64   `json:"funding_rate"`
	NextFundingTime time.Time `json:"next_funding_time"`
	MarkPrice       float64   `json:"mark_price,omitempty"`
	IndexPrice      float64   `json:"index_price,omitempty"`
	Timestamp       time.Time `json:"timestamp"`
}

// Exchange-specific funding rate response structures
type BinanceFundingRateResponse struct {
	Symbol      string `json:"symbol"`
	FundingRate string `json:"fundingRate"`
	FundingTime int64  `json:"fundingTime"`
	MarkPrice   string `json:"markPrice,omitempty"`
}

type BybitFundingRateResponse struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		List []struct {
			Symbol      string `json:"symbol"`
			FundingRate string `json:"fundingRate"`
			FundingTime string `json:"fundingTime"`
			MarkPrice   string `json:"markPrice"`
		} `json:"list"`
	} `json:"result"`
}

type OKXFundingRateResponse struct {
	Code interface{} `json:"code"` // Can be string or int
	Msg  string      `json:"msg"`
	Data []struct {
		InstType        string `json:"instType"`
		InstId          string `json:"instId"`
		FundingRate     string `json:"fundingRate"`
		NextFundingTime string `json:"nextFundingTime"`
		MarkPx          string `json:"markPx"`
	} `json:"data"`
}

// NewFundingRateAggregator creates a new funding rate aggregator
func NewFundingRateAggregator(redisClient *redis.Client, pollInterval time.Duration, symbols []string) *FundingRateAggregator {
	ctx, cancel := context.WithCancel(context.Background())

	// Normalize symbols for different exchanges
	exchanges := []string{"binance", "bybit", "okx"}

	return &FundingRateAggregator{
		redisClient:  redisClient,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		pollInterval: pollInterval,
		symbols:      symbols,
		exchanges:    exchanges,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start begins the funding rate aggregation
func (f *FundingRateAggregator) Start() {
	log.Printf("🚀 Starting Funding Rate Aggregator - polling every %v", f.pollInterval)

	// Initial fetch
	f.fetchAllFundingRates()

	// Start polling ticker
	ticker := time.NewTicker(f.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			f.fetchAllFundingRates()
		case <-f.ctx.Done():
			log.Println("📴 Funding Rate Aggregator stopped")
			return
		}
	}
}

// Stop stops the funding rate aggregator
func (f *FundingRateAggregator) Stop() {
	f.cancel()
}

// fetchAllFundingRates fetches funding rates from all exchanges
func (f *FundingRateAggregator) fetchAllFundingRates() {
	for _, exchange := range f.exchanges {
		for _, symbol := range f.symbols {
			go f.fetchFundingRate(exchange, symbol)
		}
	}
}

// fetchFundingRate fetches funding rate for a specific exchange and symbol
func (f *FundingRateAggregator) fetchFundingRate(exchange, symbol string) {
	var fundingData *FundingRateData
	var err error

	switch exchange {
	case "binance":
		fundingData, err = f.fetchBinanceFundingRate(symbol)
	case "bybit":
		fundingData, err = f.fetchBybitFundingRate(symbol)
	case "okx":
		fundingData, err = f.fetchOKXFundingRate(symbol)
	default:
		log.Printf("❌ Unknown exchange: %s", exchange)
		return
	}

	if err != nil {
		log.Printf("❌ Error fetching funding rate for %s:%s - %v", exchange, symbol, err)
		return
	}

	if fundingData != nil {
		f.publishFundingRate(fundingData)
	}
}

// fetchBinanceFundingRate fetches funding rate from Binance
func (f *FundingRateAggregator) fetchBinanceFundingRate(symbol string) (*FundingRateData, error) {
	// Convert symbol to Binance format (SOLUSDT)
	binanceSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=%s", binanceSymbol)

	resp, err := f.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var binanceResp BinanceFundingRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&binanceResp); err != nil {
		return nil, err
	}

	fundingRate, err := parseFloat(binanceResp.FundingRate)
	if err != nil {
		return nil, err
	}

	markPrice, _ := parseFloat(binanceResp.MarkPrice)

	return &FundingRateData{
		Exchange:        "binance",
		Symbol:          symbol,
		FundingRate:     fundingRate,
		NextFundingTime: time.Unix(binanceResp.FundingTime/1000, 0),
		MarkPrice:       markPrice,
		Timestamp:       time.Now(),
	}, nil
}

// fetchBybitFundingRate fetches funding rate from Bybit
func (f *FundingRateAggregator) fetchBybitFundingRate(symbol string) (*FundingRateData, error) {
	// Convert symbol to Bybit format (SOLUSDT)
	bybitSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	url := fmt.Sprintf("https://api.bybit.com/v5/market/tickers?category=linear&symbol=%s", bybitSymbol)

	resp, err := f.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bybitResp BybitFundingRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&bybitResp); err != nil {
		return nil, err
	}

	if bybitResp.RetCode != 0 || len(bybitResp.Result.List) == 0 {
		return nil, fmt.Errorf("bybit API error: %s", bybitResp.RetMsg)
	}

	data := bybitResp.Result.List[0]
	fundingRate, err := parseFloat(data.FundingRate)
	if err != nil {
		return nil, err
	}

	markPrice, _ := parseFloat(data.MarkPrice)

	// Parse funding time
	fundingTime, err := time.Parse(time.RFC3339, data.FundingTime)
	if err != nil {
		fundingTime = time.Now().Add(8 * time.Hour) // Default to next 8h interval
	}

	return &FundingRateData{
		Exchange:        "bybit",
		Symbol:          symbol,
		FundingRate:     fundingRate,
		NextFundingTime: fundingTime,
		MarkPrice:       markPrice,
		Timestamp:       time.Now(),
	}, nil
}

// fetchOKXFundingRate fetches funding rate from OKX
func (f *FundingRateAggregator) fetchOKXFundingRate(symbol string) (*FundingRateData, error) {
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

	url := fmt.Sprintf("https://www.okx.com/api/v5/public/funding-rate?instId=%s", okxSymbol)

	resp, err := f.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var okxResp OKXFundingRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&okxResp); err != nil {
		return nil, err
	}

	// Check code (can be string "0" or int 0)
	codeStr := fmt.Sprintf("%v", okxResp.Code)
	if codeStr != "0" || len(okxResp.Data) == 0 {
		return nil, fmt.Errorf("okx API error: %s", okxResp.Msg)
	}

	data := okxResp.Data[0]
	fundingRate, err := parseFloat(data.FundingRate)
	if err != nil {
		return nil, err
	}

	markPrice, _ := parseFloat(data.MarkPx)

	// Parse next funding time
	nextFundingTime, err := time.Parse("2006-01-02T15:04:05.000Z", data.NextFundingTime)
	if err != nil {
		nextFundingTime = time.Now().Add(8 * time.Hour) // Default to next 8h interval
	}

	return &FundingRateData{
		Exchange:        "okx",
		Symbol:          symbol,
		FundingRate:     fundingRate,
		NextFundingTime: nextFundingTime,
		MarkPrice:       markPrice,
		Timestamp:       time.Now(),
	}, nil
}

// publishFundingRate publishes funding rate data to Redis
func (f *FundingRateAggregator) publishFundingRate(data *FundingRateData) {
	// Channel format: funding:{exchange}:{symbol}
	channel := fmt.Sprintf("funding:%s:%s", data.Exchange, data.Symbol)

	// Serialize data
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("❌ Error marshaling funding rate data: %v", err)
		return
	}

	// Publish to Redis
	if err := f.redisClient.Publish(f.ctx, channel, payload).Err(); err != nil {
		log.Printf("❌ Error publishing funding rate to Redis: %v", err)
		return
	}

	log.Printf("📈 Published funding rate: %s | Rate: %.6f%% | Next: %s",
		channel,
		data.FundingRate*100,
		data.NextFundingTime.Format("15:04:05"))
}

// Helper function to parse float from string
func parseFloat(s string) (float64, error) {
	if s == "" {
		return 0, nil
	}

	// Remove any whitespace
	s = strings.TrimSpace(s)

	// Try standard parsing
	if f, err := json.Number(s).Float64(); err == nil {
		return f, nil
	}

	return 0, fmt.Errorf("cannot parse float: %s", s)
}
