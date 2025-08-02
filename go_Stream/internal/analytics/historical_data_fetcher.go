package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"p9_microstream/internal/events"

	"github.com/redis/go-redis/v9"
)

// ============================================================================
// HISTORICAL DATA FETCHER - 1000 CANDLES PER TIMEFRAME
// ============================================================================

type HistoricalDataFetcher struct {
	redisClient *redis.Client
	httpClient  *http.Client
	ctx         context.Context
	cancel      context.CancelFunc
}

// BinanceKlineResponse represents Binance kline/candlestick response
type BinanceKlineResponse [][]interface{}

// BybitKlineResponse represents Bybit kline response
type BybitKlineResponse struct {
	Result struct {
		List [][]string `json:"list"`
	} `json:"result"`
}

// OKXKlineResponse represents OKX candlestick response
type OKXKlineResponse struct {
	Data [][]string `json:"data"`
}

// NewHistoricalDataFetcher creates a new historical data fetcher
func NewHistoricalDataFetcher(redisClient *redis.Client) *HistoricalDataFetcher {
	ctx, cancel := context.WithCancel(context.Background())

	return &HistoricalDataFetcher{
		redisClient: redisClient,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		ctx:    ctx,
		cancel: cancel,
	}
}

// FetchAllHistoricalDataDynamic allows the caller to specify exactly which exchanges / symbols
// should be fetched.  This eliminates the previous hard-coded list and keeps the downloader
// in-sync with the YAML configuration used by the fusion engine.
func (f *HistoricalDataFetcher) FetchAllHistoricalDataDynamic(exchanges map[string][]string, timeframes []string) error {
	fmt.Println("🔄 Starting historical data fetch for INSTITUTIONAL-GRADE context (dynamic list)...")

	for exchange, symbols := range exchanges {
		for _, symbol := range symbols {
			for _, tf := range timeframes {
				fmt.Printf("📈 Fetching %s %s %s historical candles (1000 periods)...\n", exchange, symbol, tf)

				if err := f.fetchAndStoreHistoricalCandles(exchange, symbol, tf, 1000); err != nil {
					fmt.Printf("❌ Failed to fetch %s %s %s: %v\n", exchange, symbol, tf, err)
					continue
				}

				time.Sleep(100 * time.Millisecond) // basic rate-limit handling
			}
		}
	}

	fmt.Println("✅ Historical data fetch completed - READY FOR REAL-TIME FUSION")
	return nil
}

// Deprecated: kept for compatibility but now calls the dynamic version with a minimal default (SOL only)
func (f *HistoricalDataFetcher) FetchAllHistoricalData() error {
	exchanges := map[string][]string{
		"binance": {"SOLUSDT"},
		"bybit":   {"SOLUSDT"},
		"okx":     {"SOL-USDT"},
	}
	timeframes := []string{"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"}
	return f.FetchAllHistoricalDataDynamic(exchanges, timeframes)
}

// Add symbol normalization helpers
func normalizeSymbolForBinance(symbol string) string {
	return strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
}

func normalizeSymbolForBybit(symbol string) string {
	return strings.ToUpper(strings.ReplaceAll(symbol, "-", ""))
}

func normalizeSymbolForOKX(symbol string) string {
	s := strings.ToUpper(symbol)
	if !strings.Contains(s, "-") {
		s = strings.Replace(s, "USDT", "-USDT", 1)
	}
	return s
}

// fetchAndStoreHistoricalCandles fetches historical candles and stores them in Redis
func (f *HistoricalDataFetcher) fetchAndStoreHistoricalCandles(exchange, symbol, timeframe string, limit int) error {
	var candles []events.OHLCVCandle
	var err error

	// Normalize symbol for API and Redis
	var apiSymbol string
	switch exchange {
	case "binance":
		apiSymbol = normalizeSymbolForBinance(symbol)
	case "bybit":
		apiSymbol = normalizeSymbolForBybit(symbol)
	case "okx":
		apiSymbol = normalizeSymbolForOKX(symbol)
	default:
		return fmt.Errorf("unsupported exchange: %s", exchange)
	}

	fmt.Printf("[HISTORICAL-FETCH] %s %s %s: Fetching...\n", exchange, apiSymbol, timeframe)

	switch exchange {
	case "binance":
		candles, err = f.fetchBinanceHistoricalCandles(apiSymbol, timeframe, limit)
	case "bybit":
		candles, err = f.fetchBybitHistoricalCandles(apiSymbol, timeframe, limit)
	case "okx":
		candles, err = f.fetchOKXHistoricalCandles(apiSymbol, timeframe, limit)
	}

	if err != nil {
		fmt.Printf("[HISTORICAL-FETCH-ERROR] %s %s %s: %v\n", exchange, apiSymbol, timeframe, err)
		return err
	}

	if len(candles) == 0 {
		fmt.Printf("[HISTORICAL-FETCH-WARNING] %s %s %s: Got 0 candles - API may have returned empty data\n", exchange, apiSymbol, timeframe)
		return fmt.Errorf("no historical candles returned for %s %s %s", exchange, apiSymbol, timeframe)
	}

	fmt.Printf("[HISTORICAL-FETCH] %s %s %s: Got %d candles\n", exchange, apiSymbol, timeframe, len(candles))

	// Store candles in Redis with historical flag
	return f.storeHistoricalCandles(candles, exchange, apiSymbol, timeframe, limit)
}

// fetchBinanceHistoricalCandles fetches historical candles from Binance
func (f *HistoricalDataFetcher) fetchBinanceHistoricalCandles(symbol, timeframe string, limit int) ([]events.OHLCVCandle, error) {
	url := fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d",
		symbol, timeframe, limit)

	resp, err := f.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var binanceData BinanceKlineResponse
	if err := json.Unmarshal(body, &binanceData); err != nil {
		return nil, err
	}

	return f.convertBinanceToCandles(binanceData, "binance", symbol, timeframe)
}

// fetchBybitHistoricalCandles fetches historical candles from Bybit
func (f *HistoricalDataFetcher) fetchBybitHistoricalCandles(symbol, timeframe string, limit int) ([]events.OHLCVCandle, error) {
	url := fmt.Sprintf("https://api.bybit.com/v5/market/kline?category=linear&symbol=%s&interval=%s&limit=%d",
		symbol, timeframe, limit)
	fmt.Printf("[BYBIT-API] GET %s\n", url)
	resp, err := f.httpClient.Get(url)
	if err != nil {
		fmt.Printf("[BYBIT-API-ERROR] %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("[BYBIT-API-ERROR] Read body: %v\n", err)
		return nil, err
	}
	fmt.Printf("[BYBIT-API-RESPONSE] %s\n", string(body)[:min(300, len(body))])

	var bybitData BybitKlineResponse
	if err := json.Unmarshal(body, &bybitData); err != nil {
		fmt.Printf("[BYBIT-API-ERROR] JSON: %v\n", err)
		return nil, err
	}

	// Check if Bybit returned an error or empty result
	if len(bybitData.Result.List) == 0 {
		fmt.Printf("[BYBIT-API-WARNING] Empty result list for %s %s\n", symbol, timeframe)
		return nil, fmt.Errorf("bybit returned empty candle list for %s %s", symbol, timeframe)
	}

	return f.convertBybitToCandles(bybitData, "bybit", symbol, timeframe)
}

// fetchOKXHistoricalCandles fetches historical candles from OKX
func (f *HistoricalDataFetcher) fetchOKXHistoricalCandles(symbol, timeframe string, limit int) ([]events.OHLCVCandle, error) {
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
	
	url := fmt.Sprintf("https://www.okx.com/api/v5/market/candles?instId=%s&bar=%s&limit=%d",
		okxSymbol, timeframe, limit)
	fmt.Printf("[OKX-API] GET %s\n", url)
	resp, err := f.httpClient.Get(url)
	if err != nil {
		fmt.Printf("[OKX-API-ERROR] %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("[OKX-API-ERROR] Read body: %v\n", err)
		return nil, err
	}
	fmt.Printf("[OKX-API-RESPONSE] %s\n", string(body)[:min(300, len(body))])

	var okxData OKXKlineResponse
	if err := json.Unmarshal(body, &okxData); err != nil {
		fmt.Printf("[OKX-API-ERROR] JSON: %v\n", err)
		return nil, err
	}

	// Check if OKX returned an error or empty result
	if len(okxData.Data) == 0 {
		fmt.Printf("[OKX-API-WARNING] Empty data array for %s %s\n", symbol, timeframe)
		return nil, fmt.Errorf("okx returned empty candle data for %s %s", symbol, timeframe)
	}

	return f.convertOKXToCandles(okxData, "okx", symbol, timeframe)
}

// convertBinanceToCandles converts Binance kline data to OHLCVCandle
func (f *HistoricalDataFetcher) convertBinanceToCandles(data BinanceKlineResponse, exchange, symbol, timeframe string) ([]events.OHLCVCandle, error) {
	candles := make([]events.OHLCVCandle, 0, len(data))

	for _, kline := range data {
		if len(kline) < 12 {
			continue
		}

		openTime := int64(kline[0].(float64))
		open, _ := strconv.ParseFloat(kline[1].(string), 64)
		high, _ := strconv.ParseFloat(kline[2].(string), 64)
		low, _ := strconv.ParseFloat(kline[3].(string), 64)
		close, _ := strconv.ParseFloat(kline[4].(string), 64)
		volume, _ := strconv.ParseFloat(kline[5].(string), 64)
		quoteVolume, _ := strconv.ParseFloat(kline[7].(string), 64)
		tradeCount := int64(kline[8].(float64))
		takerBuyVolume, _ := strconv.ParseFloat(kline[9].(string), 64)
		takerBuyQuoteVolume, _ := strconv.ParseFloat(kline[10].(string), 64)

		candle := events.OHLCVCandle{
			Exchange:            exchange,
			Symbol:              strings.ToUpper(symbol),
			Timeframe:           timeframe,
			OpenTime:            time.Unix(openTime/1000, 0),
			CloseTime:           time.Unix(openTime/1000, 0).Add(f.getTimeframeDuration(timeframe)),
			Open:                open,
			High:                high,
			Low:                 low,
			Close:               close,
			Volume:              volume,
			QuoteVolume:         quoteVolume,
			TradeCount:          tradeCount,
			TakerBuyVolume:      takerBuyVolume,
			TakerBuyQuoteVolume: takerBuyQuoteVolume,
			VWAP:                (high + low + close) / 3, // Approximation
			IsComplete:          true,
			IsHistorical:        true,
			Timestamp:           time.Now(),
		}

		candles = append(candles, candle)
	}

	return candles, nil
}

// convertBybitToCandles converts Bybit kline data to OHLCVCandle
func (f *HistoricalDataFetcher) convertBybitToCandles(data BybitKlineResponse, exchange, symbol, timeframe string) ([]events.OHLCVCandle, error) {
	candles := make([]events.OHLCVCandle, 0, len(data.Result.List))

	for _, kline := range data.Result.List {
		if len(kline) < 7 {
			continue
		}

		openTime, _ := strconv.ParseInt(kline[0], 10, 64)
		open, _ := strconv.ParseFloat(kline[1], 64)
		high, _ := strconv.ParseFloat(kline[2], 64)
		low, _ := strconv.ParseFloat(kline[3], 64)
		close, _ := strconv.ParseFloat(kline[4], 64)
		volume, _ := strconv.ParseFloat(kline[5], 64)
		quoteVolume, _ := strconv.ParseFloat(kline[6], 64)

		candle := events.OHLCVCandle{
			Exchange:     exchange,
			Symbol:       strings.ToUpper(symbol),
			Timeframe:    timeframe,
			OpenTime:     time.Unix(openTime/1000, 0),
			CloseTime:    time.Unix(openTime/1000, 0).Add(f.getTimeframeDuration(timeframe)),
			Open:         open,
			High:         high,
			Low:          low,
			Close:        close,
			Volume:       volume,
			QuoteVolume:  quoteVolume,
			TradeCount:   0, // Not provided by Bybit
			VWAP:         (high + low + close) / 3,
			IsComplete:   true,
			IsHistorical: true,
			Timestamp:    time.Now(),
		}

		candles = append(candles, candle)
	}

	return candles, nil
}

// convertOKXToCandles converts OKX candlestick data to OHLCVCandle
func (f *HistoricalDataFetcher) convertOKXToCandles(data OKXKlineResponse, exchange, symbol, timeframe string) ([]events.OHLCVCandle, error) {
	candles := make([]events.OHLCVCandle, 0, len(data.Data))

	for _, kline := range data.Data {
		if len(kline) < 9 {
			continue
		}

		openTime, _ := strconv.ParseInt(kline[0], 10, 64)
		open, _ := strconv.ParseFloat(kline[1], 64)
		high, _ := strconv.ParseFloat(kline[2], 64)
		low, _ := strconv.ParseFloat(kline[3], 64)
		close, _ := strconv.ParseFloat(kline[4], 64)
		volume, _ := strconv.ParseFloat(kline[5], 64)
		quoteVolume, _ := strconv.ParseFloat(kline[6], 64)

		candle := events.OHLCVCandle{
			Exchange:     exchange,
			Symbol:       strings.ToUpper(symbol),
			Timeframe:    timeframe,
			OpenTime:     time.Unix(openTime/1000, 0),
			CloseTime:    time.Unix(openTime/1000, 0).Add(f.getTimeframeDuration(timeframe)),
			Open:         open,
			High:         high,
			Low:          low,
			Close:        close,
			Volume:       volume,
			QuoteVolume:  quoteVolume,
			TradeCount:   0, // Not provided by OKX
			VWAP:         (high + low + close) / 3,
			IsComplete:   true,
			IsHistorical: true,
			Timestamp:    time.Now(),
		}

		candles = append(candles, candle)
	}

	return candles, nil
}

// storeHistoricalCandles stores historical candles in Redis
func (f *HistoricalDataFetcher) storeHistoricalCandles(candles []events.OHLCVCandle, exchange, symbol, timeframe string, limit int) error {
	channel := fmt.Sprintf("candles:%s:%s", strings.ToUpper(symbol), timeframe)

	historyKey := fmt.Sprintf("history:candles:%s:%s:%s", strings.ToLower(exchange), strings.ToUpper(symbol), timeframe)

	pipe := f.redisClient.Pipeline()

	for _, candle := range candles {
		data, err := json.Marshal(candle)
		if err != nil {
			return err
		}

		// Use ZADD instead of LPUSH to store as a sorted set with open_time as the score
		pipe.ZAdd(f.ctx, historyKey, redis.Z{
			Score:  float64(candle.OpenTime.Unix()),
			Member: data,
		})

		// Also publish to live channel for immediate consumption
		pipe.Publish(f.ctx, channel, data)
	}

	if _, err := pipe.Exec(f.ctx); err != nil {
		return err
	}

	// Trim to last `limit` candles and set 7-day TTL
	f.redisClient.ZRemRangeByRank(f.ctx, historyKey, 0, int64(-limit-1))
	f.redisClient.Expire(f.ctx, historyKey, 7*24*time.Hour)

	fmt.Printf("✅ Stored %d historical %s candles for %s %s\n",
		len(candles), timeframe, exchange, symbol)
	return nil
}

// getTimeframeDuration converts timeframe string to time.Duration
func (f *HistoricalDataFetcher) getTimeframeDuration(timeframe string) time.Duration {
	switch timeframe {
	case "1m":
		return time.Minute
	case "3m":
		return 3 * time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	case "2h":
		return 2 * time.Hour
	case "4h":
		return 4 * time.Hour
	case "6h":
		return 6 * time.Hour
	case "12h":
		return 12 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return time.Minute
	}
}

// Stop stops the historical data fetcher
func (f *HistoricalDataFetcher) Stop() {
	f.cancel()
}

// FetchMarkPrice fetches the mark price for a given exchange and symbol
func (f *HistoricalDataFetcher) FetchMarkPrice(exchange, symbol string) (float64, error) {
	var url string
	var okxSymbol string // Specific format for OKX

	if !strings.Contains(strings.ToUpper(symbol), "-") {
		okxSymbol = strings.Replace(strings.ToUpper(symbol), "USDT", "-USDT-SWAP", 1)
	} else {
		okxSymbol = strings.ToUpper(symbol) + "-SWAP"
	}

	switch exchange {
	case "binance":
		url = fmt.Sprintf("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=%s", symbol)
	case "bybit":
		url = fmt.Sprintf("https://api.bybit.com/v5/market/tickers?category=linear&symbol=%s", symbol)
	case "okx":
		url = fmt.Sprintf("https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=%s", okxSymbol)
	default:
		return 0, fmt.Errorf("unsupported exchange for mark price: %s", exchange)
	}

	resp, err := f.httpClient.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var markPriceResponse struct {
		Result struct {
			MarkPrice float64 `json:"markPrice"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &markPriceResponse); err != nil {
		return 0, err
	}

	return markPriceResponse.Result.MarkPrice, nil
}

// Helper for safe substring
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
