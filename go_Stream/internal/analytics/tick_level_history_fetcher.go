package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// TickLevelHistoryFetcher fetches tick-level trade history from exchanges
// Item 17: Tick-level trade history (3h) - REST /aggTrades?startTime= loop
type TickLevelHistoryFetcher struct {
	redisClient   *redis.Client
	httpClient    *http.Client
	symbols       []string
	exchanges     []string
	lookbackHours int
	ctx           context.Context
	cancel        context.CancelFunc
}

// TickData represents individual tick-level trade data
type TickData struct {
	Exchange     string    `json:"exchange"`
	Symbol       string    `json:"symbol"`
	TradeID      string    `json:"trade_id"`
	Price        float64   `json:"price"`
	Quantity     float64   `json:"quantity"`
	Timestamp    time.Time `json:"timestamp"`
	IsBuyerMaker bool      `json:"is_buyer_maker"`
	QuoteQty     float64   `json:"quote_qty"`
}

// Exchange-specific response structures
type BinanceAggTradeResponse []struct {
	AggTradeID   int64  `json:"a"`
	Price        string `json:"p"`
	Quantity     string `json:"q"`
	FirstTradeID int64  `json:"f"`
	LastTradeID  int64  `json:"l"`
	Timestamp    int64  `json:"T"`
	IsBuyerMaker bool   `json:"m"`
	IsBestMatch  bool   `json:"M"`
}

type BybitTradeResponse struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		List []struct {
			ExecID       string `json:"execId"`
			Symbol       string `json:"symbol"`
			Price        string `json:"price"`
			Size         string `json:"size"`
			Side         string `json:"side"`
			Time         string `json:"time"`
			IsBlockTrade bool   `json:"isBlockTrade"`
		} `json:"list"`
	} `json:"result"`
}

type OKXTradeResponse struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
	Data []struct {
		InstID    string `json:"instId"`
		TradeID   string `json:"tradeId"`
		Price     string `json:"px"`
		Size      string `json:"sz"`
		Side      string `json:"side"`
		Timestamp string `json:"ts"`
	} `json:"data"`
}

// NewTickLevelHistoryFetcher creates a new tick-level history fetcher
func NewTickLevelHistoryFetcher(redisClient *redis.Client, symbols []string) *TickLevelHistoryFetcher {
	ctx, cancel := context.WithCancel(context.Background())

	return &TickLevelHistoryFetcher{
		redisClient:   redisClient,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		symbols:       symbols,
		exchanges:     []string{"binance", "bybit", "okx"},
		lookbackHours: 3, // 3 hours for CVD/VPIN bootstrap
		ctx:           ctx,
		cancel:        cancel,
	}
}

// FetchAllTickHistory fetches tick-level history for all symbols and exchanges
func (t *TickLevelHistoryFetcher) FetchAllTickHistory() error {
	log.Printf("🔄 Starting tick-level trade history fetch (3h lookback)...")

	startTime := time.Now().Add(-time.Duration(t.lookbackHours) * time.Hour)

	for _, exchange := range t.exchanges {
		for _, symbol := range t.symbols {
			log.Printf("📈 Fetching %s %s tick history from %v...", exchange, symbol, startTime)

			if err := t.fetchTickHistoryForSymbol(exchange, symbol, startTime); err != nil {
				log.Printf("❌ Failed to fetch %s %s tick history: %v", exchange, symbol, err)
				continue
			}

			// Rate limiting between requests
			time.Sleep(200 * time.Millisecond)
		}
	}

	log.Printf("✅ Tick-level history fetch completed")
	return nil
}

// fetchTickHistoryForSymbol fetches tick history for a specific symbol
func (t *TickLevelHistoryFetcher) fetchTickHistoryForSymbol(exchange, symbol string, startTime time.Time) error {
	var ticks []TickData
	var err error

	switch exchange {
	case "binance":
		ticks, err = t.fetchBinanceTickHistory(symbol, startTime)
	case "bybit":
		ticks, err = t.fetchBybitTickHistory(symbol, startTime)
	case "okx":
		ticks, err = t.fetchOKXTickHistory(symbol, startTime)
	default:
		return fmt.Errorf("unsupported exchange: %s", exchange)
	}

	if err != nil {
		return err
	}

	// Store ticks in Redis
	return t.storeTickHistory(ticks, exchange, symbol)
}

// fetchBinanceTickHistory fetches tick history from Binance aggTrades endpoint
func (t *TickLevelHistoryFetcher) fetchBinanceTickHistory(symbol string, startTime time.Time) ([]TickData, error) {
	binanceSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	startTimestamp := startTime.UnixMilli()
	endTimestamp := time.Now().UnixMilli()

	url := fmt.Sprintf("https://api.binance.com/api/v3/aggTrades?symbol=%s&startTime=%d&endTime=%d&limit=1000",
		binanceSymbol, startTimestamp, endTimestamp)

	resp, err := t.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var binanceData BinanceAggTradeResponse
	if err := json.Unmarshal(body, &binanceData); err != nil {
		return nil, err
	}

	return t.convertBinanceTicksToStandard(binanceData, symbol)
}

// fetchBybitTickHistory fetches tick history from Bybit
func (t *TickLevelHistoryFetcher) fetchBybitTickHistory(symbol string, startTime time.Time) ([]TickData, error) {
	bybitSymbol := strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
	startTimestamp := startTime.UnixMilli()
	endTimestamp := time.Now().UnixMilli()

	url := fmt.Sprintf("https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=%s&limit=1000",
		bybitSymbol)

	log.Printf("[BYBIT-TICK-API] GET %s\n", url)
	resp, err := t.httpClient.Get(url)
	if err != nil {
		log.Printf("[BYBIT-TICK-API-ERROR] %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[BYBIT-TICK-API-ERROR] Read body: %v\n", err)
		return nil, err
	}

	log.Printf("[BYBIT-TICK-API-RESPONSE] %s\n", string(body)[:min(300, len(body))])

	var bybitData BybitTradeResponse
	if err := json.Unmarshal(body, &bybitData); err != nil {
		log.Printf("[BYBIT-TICK-API-ERROR] JSON: %v\n", err)
		return nil, err
	}

	// Check for API errors
	if bybitData.RetCode != 0 {
		log.Printf("[BYBIT-TICK-API-ERROR] API returned error: %s (code: %d)\n", bybitData.RetMsg, bybitData.RetCode)
		return nil, fmt.Errorf("bybit API error: %s (code: %d)", bybitData.RetMsg, bybitData.RetCode)
	}

	if len(bybitData.Result.List) == 0 {
		log.Printf("[BYBIT-TICK-API-WARNING] Empty trade list for %s\n", symbol)
		return nil, fmt.Errorf("bybit returned empty trade list for %s", symbol)
	}

	return t.convertBybitTicksToStandard(bybitData, symbol, startTimestamp, endTimestamp)
}

// fetchOKXTickHistory fetches tick history from OKX
func (t *TickLevelHistoryFetcher) fetchOKXTickHistory(symbol string, startTime time.Time) ([]TickData, error) {
	// Normalize symbol for OKX FUTURES format: solusdt -> SOL-USDT-SWAP, sol-usdt -> SOL-USDT-SWAP
	var okxSymbol string
	if len(symbol) > 4 && strings.ToLower(symbol[len(symbol)-4:]) == "usdt" {
		base := strings.ToUpper(symbol[:len(symbol)-4])
		okxSymbol = fmt.Sprintf("%s-USDT-SWAP", base)
	} else {
		// Handle sol-usdt format
		parts := strings.Split(strings.ToUpper(symbol), "-")
		if len(parts) == 2 && parts[1] == "USDT" {
			okxSymbol = fmt.Sprintf("%s-USDT-SWAP", parts[0])
		} else {
			// Fallback
			okxSymbol = fmt.Sprintf("%s-SWAP", strings.ToUpper(symbol))
		}
	}

	url := fmt.Sprintf("https://www.okx.com/api/v5/market/trades?instId=%s&limit=500", okxSymbol)

	log.Printf("[OKX-TICK-API] GET %s\n", url)
	resp, err := t.httpClient.Get(url)
	if err != nil {
		log.Printf("[OKX-TICK-API-ERROR] %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[OKX-TICK-API-ERROR] Read body: %v\n", err)
		return nil, err
	}

	log.Printf("[OKX-TICK-API-RESPONSE] %s\n", string(body)[:min(300, len(body))])

	var okxData OKXTradeResponse
	if err := json.Unmarshal(body, &okxData); err != nil {
		log.Printf("[OKX-TICK-API-ERROR] JSON: %v\n", err)
		return nil, err
	}

	// Check for API errors
	if okxData.Code != "0" {
		log.Printf("[OKX-TICK-API-ERROR] API returned error: %s (code: %s)\n", okxData.Msg, okxData.Code)
		return nil, fmt.Errorf("okx API error: %s (code: %s)", okxData.Msg, okxData.Code)
	}

	if len(okxData.Data) == 0 {
		log.Printf("[OKX-TICK-API-WARNING] Empty trade data for %s\n", symbol)
		return nil, fmt.Errorf("okx returned empty trade data for %s", symbol)
	}

	return t.convertOKXTicksToStandard(okxData, symbol)
}

// convertBinanceTicksToStandard converts Binance tick data to standard format
func (t *TickLevelHistoryFetcher) convertBinanceTicksToStandard(data BinanceAggTradeResponse, symbol string) ([]TickData, error) {
	ticks := make([]TickData, 0, len(data))

	for _, trade := range data {
		price, _ := strconv.ParseFloat(trade.Price, 64)
		quantity, _ := strconv.ParseFloat(trade.Quantity, 64)

		tick := TickData{
			Exchange:     "binance",
			Symbol:       strings.ToLower(symbol),
			TradeID:      fmt.Sprintf("%d", trade.AggTradeID),
			Price:        price,
			Quantity:     quantity,
			Timestamp:    time.Unix(trade.Timestamp/1000, 0),
			IsBuyerMaker: trade.IsBuyerMaker,
			QuoteQty:     price * quantity,
		}

		ticks = append(ticks, tick)
	}

	return ticks, nil
}

// convertBybitTicksToStandard converts Bybit tick data to standard format
func (t *TickLevelHistoryFetcher) convertBybitTicksToStandard(data BybitTradeResponse, symbol string, startTime, endTime int64) ([]TickData, error) {
	_ = startTime // Mark as used to avoid compiler warning
	_ = endTime   // Mark as used to avoid compiler warning

	ticks := make([]TickData, 0, len(data.Result.List))

	for _, trade := range data.Result.List {
		price, _ := strconv.ParseFloat(trade.Price, 64)
		size, _ := strconv.ParseFloat(trade.Size, 64)
		timestamp, _ := strconv.ParseInt(trade.Time, 10, 64)

		// Filter by time range
		if timestamp < startTime || timestamp > endTime {
			continue
		}

		tick := TickData{
			Exchange:     "bybit",
			Symbol:       strings.ToLower(symbol),
			TradeID:      trade.ExecID,
			Price:        price,
			Quantity:     size,
			Timestamp:    time.Unix(timestamp/1000, 0),
			IsBuyerMaker: trade.Side == "Sell", // Bybit: Sell = buyer is maker
			QuoteQty:     price * size,
		}

		ticks = append(ticks, tick)
	}

	return ticks, nil
}

// convertOKXTicksToStandard converts OKX tick data to standard format
func (t *TickLevelHistoryFetcher) convertOKXTicksToStandard(data OKXTradeResponse, symbol string) ([]TickData, error) {
	ticks := make([]TickData, 0, len(data.Data))

	for _, trade := range data.Data {
		price, _ := strconv.ParseFloat(trade.Price, 64)
		size, _ := strconv.ParseFloat(trade.Size, 64)
		timestamp, _ := strconv.ParseInt(trade.Timestamp, 10, 64)

		tick := TickData{
			Exchange:     "okx",
			Symbol:       strings.ToLower(symbol),
			TradeID:      trade.TradeID,
			Price:        price,
			Quantity:     size,
			Timestamp:    time.Unix(timestamp/1000, 0),
			IsBuyerMaker: trade.Side == "sell", // OKX: sell = buyer is maker
			QuoteQty:     price * size,
		}

		ticks = append(ticks, tick)
	}

	return ticks, nil
}

// storeTickHistory stores tick-level data in Redis
func (t *TickLevelHistoryFetcher) storeTickHistory(ticks []TickData, exchange, symbol string) error {
	if len(ticks) == 0 {
		return nil
	}

	pipe := t.redisClient.Pipeline()

	for _, tick := range ticks {
		key := fmt.Sprintf("trade_history:%s:%s:%d", exchange, symbol, tick.Timestamp.Unix())

		tickJSON, err := json.Marshal(tick)
		if err != nil {
			continue
		}

		pipe.Set(t.ctx, key, tickJSON, 24*time.Hour) // 24h TTL
	}

	// Also store summary for quick access
	summaryKey := fmt.Sprintf("trade_history_summary:%s:%s", exchange, symbol)
	summary := map[string]interface{}{
		"count":      len(ticks),
		"start_time": ticks[0].Timestamp.Unix(),
		"end_time":   ticks[len(ticks)-1].Timestamp.Unix(),
		"updated":    time.Now().Unix(),
	}

	summaryJSON, _ := json.Marshal(summary)
	pipe.Set(t.ctx, summaryKey, summaryJSON, 24*time.Hour)

	_, err := pipe.Exec(t.ctx)
	if err != nil {
		return fmt.Errorf("failed to store tick history: %w", err)
	}

	log.Printf("✅ Stored %d ticks for %s:%s", len(ticks), exchange, symbol)
	return nil
}

// GetTickHistory retrieves stored tick history from Redis
func (t *TickLevelHistoryFetcher) GetTickHistory(exchange, symbol string, startTime, endTime time.Time) ([]TickData, error) {
	pattern := fmt.Sprintf("trade_history:%s:%s:*", exchange, symbol)

	keys, err := t.redisClient.Keys(t.ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	var ticks []TickData

	for _, key := range keys {
		tickJSON, err := t.redisClient.Get(t.ctx, key).Result()
		if err != nil {
			continue
		}

		var tick TickData
		if err := json.Unmarshal([]byte(tickJSON), &tick); err != nil {
			continue
		}

		// Filter by time range
		if tick.Timestamp.After(startTime) && tick.Timestamp.Before(endTime) {
			ticks = append(ticks, tick)
		}
	}

	return ticks, nil
}

// Stop stops the tick-level history fetcher
func (t *TickLevelHistoryFetcher) Stop() {
	t.cancel()
}
