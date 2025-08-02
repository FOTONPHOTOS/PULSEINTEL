package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCandleAggregator processes raw trade data into historical candles
type RedisCandleAggregator struct {
	redisClient *redis.Client
	ctx         context.Context
}

// RedisTrade represents a trade entry from Redis
type RedisTrade struct {
	Price     float64   `json:"price"`
	Volume    float64   `json:"volume"`
	Timestamp time.Time `json:"timestamp"`
	Side      string    `json:"side"`
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
}

// CandleData represents an OHLCV candle
type CandleData struct {
	OpenTime   time.Time `json:"open_time"`
	CloseTime  time.Time `json:"close_time"`
	Open       float64   `json:"open"`
	High       float64   `json:"high"`
	Low        float64   `json:"low"`
	Close      float64   `json:"close"`
	Volume     float64   `json:"volume"`
	TradeCount int       `json:"trade_count"`
}

// NewRedisCandleAggregator creates a new candle aggregator
func NewRedisCandleAggregator(redisClient *redis.Client) *RedisCandleAggregator {
	return &RedisCandleAggregator{
		redisClient: redisClient,
		ctx:         context.Background(),
	}
}

// ProcessAllSymbols processes all available symbols and generates historical candles
func (r *RedisCandleAggregator) ProcessAllSymbols() error {
	log.Println("🔄 Starting Redis Trade Aggregation - Processing existing trade data...")

	// Find all trade history keys
	tradeKeys, err := r.redisClient.Keys(r.ctx, "trade_history:*").Result()
	if err != nil {
		return fmt.Errorf("failed to get trade history keys: %w", err)
	}

	log.Printf("📊 Found %d trade history keys in Redis", len(tradeKeys))

	// Group by exchange+symbol so each market has its own candle set
	exSymTrades := make(map[string][]string)
	for _, key := range tradeKeys {
		parts := strings.Split(key, ":")
		if len(parts) < 4 {
			continue
		}
		exchange := parts[1]
		symbol := strings.ToUpper(parts[2])
		mapKey := fmt.Sprintf("%s:%s", exchange, symbol)
		exSymTrades[mapKey] = append(exSymTrades[mapKey], key)
	}

	log.Printf("🎯 Processing %d unique exchange-symbol pairs", len(exSymTrades))

	// Process each market individually
	for exSym, keys := range exSymTrades {
		parts := strings.SplitN(exSym, ":", 2)
		if len(parts) != 2 {
			continue
		}
		exchange, symbol := parts[0], parts[1]

		log.Printf("⚡ Processing %s %s with %d trade entries...", exchange, symbol, len(keys))

		if err := r.ProcessSymbolCandles(exchange, symbol, keys); err != nil {
			log.Printf("❌ Error processing %s %s: %v", exchange, symbol, err)
			continue
		}

		log.Printf("✅ Completed candle aggregation for %s %s", exchange, symbol)
	}

	log.Println("🎉 Redis Trade Aggregation Complete - Historical candles generated!")
	return nil
}

// ProcessSymbolCandles processes a single symbol's trade data into candles
func (r *RedisCandleAggregator) ProcessSymbolCandles(exchange, symbol string, tradeKeys []string) error {
	// Collect all trades for this symbol
	var allTrades []RedisTrade

	for _, key := range tradeKeys {
		trades, err := r.extractTradesFromKey(key)
		if err != nil {
			log.Printf("⚠️ Failed to extract trades from %s: %v", key, err)
			continue
		}
		allTrades = append(allTrades, trades...)
	}

	if len(allTrades) == 0 {
		log.Printf("⚠️ No valid trades found for %s %s", exchange, symbol)
		return nil
	}

	// Sort trades by timestamp
	sort.Slice(allTrades, func(i, j int) bool {
		return allTrades[i].Timestamp.Before(allTrades[j].Timestamp)
	})

	log.Printf("📈 Processing %d trades for %s %s (from %v to %v)",
		len(allTrades), exchange, symbol,
		allTrades[0].Timestamp.Format("15:04:05"),
		allTrades[len(allTrades)-1].Timestamp.Format("15:04:05"))

	// Define timeframes with FULL 1000-candle retention strategy (restore original working limits)
	timeframes := map[string]struct {
		Duration time.Duration
		Limit    int
	}{
		"1m":  {Duration: 1 * time.Minute, Limit: 1000},  // 16+ hours
		"3m":  {Duration: 3 * time.Minute, Limit: 1000},  // 50+ hours
		"5m":  {Duration: 5 * time.Minute, Limit: 1000},  // 3+ days
		"15m": {Duration: 15 * time.Minute, Limit: 1000}, // 10+ days
		"30m": {Duration: 30 * time.Minute, Limit: 1000}, // 20+ days
		"1h":  {Duration: 1 * time.Hour, Limit: 1000},    // 41+ days
		"2h":  {Duration: 2 * time.Hour, Limit: 1000},    // 83+ days
		"4h":  {Duration: 4 * time.Hour, Limit: 1000},    // 166+ days
		"6h":  {Duration: 6 * time.Hour, Limit: 1000},    // 250+ days
		"12h": {Duration: 12 * time.Hour, Limit: 1000},   // 500+ days
		"1d":  {Duration: 24 * time.Hour, Limit: 1000},   // 1000+ days (2.7+ years)
	}

	// Generate candles for each timeframe
	for tf, config := range timeframes {
		candles := r.generateCandlesLinear(allTrades, config.Duration)

		if len(candles) == 0 {
			log.Printf("⚠️ No candles generated for %s %s %s", exchange, symbol, tf)
			continue
		}

		// Apply retention limit (keep most recent candles)
		if len(candles) > config.Limit {
			candles = candles[len(candles)-config.Limit:]
		}

		// Store in Redis with proper key format
		err := r.storeCandles(exchange, symbol, tf, candles, config.Limit)
		if err != nil {
			log.Printf("❌ Failed to store %s %s %s candles: %v", exchange, symbol, tf, err)
			continue
		}

		log.Printf("✅ Stored %d %s candles for %s %s (retention limit: %d)",
			len(candles), tf, exchange, symbol, config.Limit)
	}

	return nil
}

// extractTradesFromKey extracts trade data from a Redis key
func (r *RedisCandleAggregator) extractTradesFromKey(key string) ([]RedisTrade, error) {
	data, err := r.redisClient.Get(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	// Parse the trade data (handle different formats)
	var trades []RedisTrade
	var rawData interface{}

	if err := json.Unmarshal([]byte(data), &rawData); err != nil {
		return nil, err
	}

	// Extract exchange and symbol from key
	parts := strings.Split(key, ":")
	if len(parts) < 4 {
		return nil, fmt.Errorf("invalid key format: %s", key)
	}

	exchange := parts[1]
	symbol := parts[2]
	timestampStr := parts[3]

	// Parse timestamp from key
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		timestamp = time.Now().Unix()
	}
	tradeTime := time.Unix(timestamp, 0)

	// Handle different data formats
	switch v := rawData.(type) {
	case []interface{}:
		// Array of trades
		for _, tradeItem := range v {
			if tradeMap, ok := tradeItem.(map[string]interface{}); ok {
				trade := r.parseTradeData(tradeMap, exchange, symbol, tradeTime)
				if trade != nil {
					trades = append(trades, *trade)
				}
			}
		}
	case map[string]interface{}:
		// Single trade
		trade := r.parseTradeData(v, exchange, symbol, tradeTime)
		if trade != nil {
			trades = append(trades, *trade)
		}
	}

	return trades, nil
}

// parseTradeData parses a single trade data entry
func (r *RedisCandleAggregator) parseTradeData(data map[string]interface{}, exchange, symbol string, fallbackTime time.Time) *RedisTrade {
	trade := &RedisTrade{
		Exchange:  exchange,
		Symbol:    symbol,
		Timestamp: fallbackTime,
	}

	// Extract price
	if price, ok := data["price"]; ok {
		if priceFloat, ok := price.(float64); ok {
			trade.Price = priceFloat
		} else if priceStr, ok := price.(string); ok {
			if p, err := strconv.ParseFloat(priceStr, 64); err == nil {
				trade.Price = p
			}
		}
	}

	// Extract volume (actual field is "quantity" in Redis)
	if quantity, ok := data["quantity"]; ok {
		if qtyFloat, ok := quantity.(float64); ok {
			trade.Volume = qtyFloat
		} else if qtyStr, ok := quantity.(string); ok {
			if v, err := strconv.ParseFloat(qtyStr, 64); err == nil {
				trade.Volume = v
			}
		}
	} else if volume, ok := data["volume"]; ok {
		if volumeFloat, ok := volume.(float64); ok {
			trade.Volume = volumeFloat
		} else if volumeStr, ok := volume.(string); ok {
			if v, err := strconv.ParseFloat(volumeStr, 64); err == nil {
				trade.Volume = v
			}
		}
	} else if qty, ok := data["qty"]; ok {
		if qtyFloat, ok := qty.(float64); ok {
			trade.Volume = qtyFloat
		} else if qtyStr, ok := qty.(string); ok {
			if v, err := strconv.ParseFloat(qtyStr, 64); err == nil {
				trade.Volume = v
			}
		}
	}

	// Extract side (stored as is_buyer_maker boolean in Redis)
	if side, ok := data["side"]; ok {
		if sideStr, ok := side.(string); ok {
			trade.Side = sideStr
		}
	} else if isBuyerMaker, ok := data["is_buyer_maker"]; ok {
		if buyerMaker, ok := isBuyerMaker.(bool); ok {
			if buyerMaker {
				trade.Side = "sell" // buyer_maker means market sell
			} else {
				trade.Side = "buy" // not buyer_maker means market buy
			}
		}
	}

	// Extract timestamp (stored as ISO string in Redis)
	if ts, ok := data["timestamp"]; ok {
		if tsStr, ok := ts.(string); ok {
			// Try parsing ISO format first
			if parsedTime, err := time.Parse(time.RFC3339, tsStr); err == nil {
				trade.Timestamp = parsedTime
			} else if t, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
				trade.Timestamp = time.Unix(t, 0)
			}
		} else if tsFloat, ok := ts.(float64); ok {
			trade.Timestamp = time.Unix(int64(tsFloat), 0)
		}
	}

	// Validate trade data
	if trade.Price <= 0 || trade.Volume <= 0 {
		return nil // Invalid trade
	}

	return trade
}

// generateCandlesLinear builds candles in a single pass (O(n))
func (r *RedisCandleAggregator) generateCandlesLinear(trades []RedisTrade, interval time.Duration) []CandleData {
	if len(trades) == 0 {
		return nil
	}

	var candles []CandleData

	currentStart := trades[0].Timestamp.Truncate(interval)
	currentEnd := currentStart.Add(interval)
	var c CandleData
	c.OpenTime = currentStart
	c.CloseTime = currentEnd.Add(-time.Millisecond)
	c.Open = trades[0].Price
	c.High = trades[0].Price
	c.Low = trades[0].Price

	for _, trade := range trades {
		// Advance window until trade falls inside
		for !trade.Timestamp.Before(currentEnd) {
			if c.TradeCount > 0 {
				candles = append(candles, c)
			}
			// start new candle
			currentStart = currentEnd
			currentEnd = currentStart.Add(interval)
			c = CandleData{OpenTime: currentStart, CloseTime: currentEnd.Add(-time.Millisecond), Open: trade.Price, High: trade.Price, Low: trade.Price}
		}

		// update candle
		if trade.Price > c.High {
			c.High = trade.Price
		}
		if trade.Price < c.Low {
			c.Low = trade.Price
		}
		c.Close = trade.Price
		c.Volume += trade.Volume
		c.TradeCount++
	}

	// append last candle
	if c.TradeCount > 0 {
		candles = append(candles, c)
	}

	return candles
}

// storeCandles stores candles in Redis with proper key format
func (r *RedisCandleAggregator) storeCandles(exchange, symbol, timeframe string, candles []CandleData, limit int) error {
	key := fmt.Sprintf("history:candles:%s:%s:%s", exchange, symbol, timeframe)

	// Store each candle as a member of a sorted set, using open_time as the score
	pipe := r.redisClient.Pipeline()
	for _, candle := range candles {
		candleJSON, err := json.Marshal(candle)
		if err != nil {
			return err
		}
		pipe.ZAdd(r.ctx, key, redis.Z{
			Score:  float64(candle.OpenTime.Unix()),
			Member: candleJSON,
		})
	}

	// Execute pipeline (adds)
	if _, err := pipe.Exec(r.ctx); err != nil {
		return err
	}

	// Trim to last `limit` candles and set 7-day TTL
	r.redisClient.ZRemRangeByRank(r.ctx, key, 0, int64(-limit-1))
	r.redisClient.Expire(r.ctx, key, 7*24*time.Hour)

	log.Printf("💾 Stored %s with %d candles (sorted set, limit %d)", key, len(candles), limit)
	return nil
}

// GetHistoricalCandles retrieves stored candles from Redis
func (r *RedisCandleAggregator) GetHistoricalCandles(exchange, symbol, timeframe string) ([]CandleData, error) {
	key := fmt.Sprintf("history:candles:%s:%s:%s", exchange, symbol, timeframe)

	// Retrieve all members in score order (oldest → newest)
	vals, err := r.redisClient.ZRange(r.ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}

	candles := make([]CandleData, 0, len(vals))
	for _, v := range vals {
		var c CandleData
		if err := json.Unmarshal([]byte(v), &c); err != nil {
			return nil, err
		}
		candles = append(candles, c)
	}
	return candles, nil
}
