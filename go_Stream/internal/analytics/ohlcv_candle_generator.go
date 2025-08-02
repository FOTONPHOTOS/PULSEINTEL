package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"p9_microstream/internal/events"

	"github.com/redis/go-redis/v9"
)

// ============================================================================
// MULTI-TIMEFRAME OHLCV CANDLE GENERATOR
// ============================================================================

// OHLCVCandleGenerator generates OHLCV candles from trade data with memory optimization
type OHLCVCandleGenerator struct {
	redisClient *redis.Client
	candles     map[string]map[string]*CandleBuilder // symbol -> timeframe -> candle
	mutex       sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc

	// Multi-timeframe support - from micro to macro
	timeframes []string
	intervals  map[string]time.Duration

	// Memory optimization settings
	maxCandlesPerTimeframe int
	publishThrottle        map[string]time.Time // Track last publish time per symbol-timeframe
	throttleMutex          sync.RWMutex
}

// CandleBuilder builds OHLCV candles for a specific timeframe
type CandleBuilder struct {
	Exchange  string
	Symbol    string
	Timeframe string
	Interval  time.Duration

	OpenTime            time.Time
	CloseTime           time.Time
	Open                float64
	High                float64
	Low                 float64
	Close               float64
	Volume              float64
	QuoteVolume         float64
	TradeCount          int64
	TakerBuyVolume      float64
	TakerBuyQuoteVolume float64
	VWAPSum             float64
	VWAPVolume          float64

	IsInitialized bool
	mutex         sync.RWMutex
}

// NewOHLCVCandleGenerator creates a new OHLCV candle generator with memory optimization
func NewOHLCVCandleGenerator(redisClient *redis.Client) *OHLCVCandleGenerator {
	ctx, cancel := context.WithCancel(context.Background())

	// COMPREHENSIVE TIMEFRAME COVERAGE - From micro to macro analysis
	timeframes := []string{
		"1s", "5s", "15s", "30s", // Micro timeframes for scalping
		"1m", "3m", "5m", "15m", "30m", // Short timeframes for day trading
		"1h", "2h", "4h", "6h", "12h", // Medium timeframes for swing trading
		"1d", // Daily for position trading
	}

	intervals := map[string]time.Duration{
		"1s":  1 * time.Second,
		"5s":  5 * time.Second,
		"15s": 15 * time.Second,
		"30s": 30 * time.Second,
		"1m":  1 * time.Minute,
		"3m":  3 * time.Minute,
		"5m":  5 * time.Minute,
		"15m": 15 * time.Minute,
		"30m": 30 * time.Minute,
		"1h":  1 * time.Hour,
		"2h":  2 * time.Hour,
		"4h":  4 * time.Hour,
		"6h":  6 * time.Hour,
		"12h": 12 * time.Hour,
		"1d":  24 * time.Hour,
	}

	generator := &OHLCVCandleGenerator{
		redisClient:            redisClient,
		candles:                make(map[string]map[string]*CandleBuilder),
		ctx:                    ctx,
		cancel:                 cancel,
		timeframes:             timeframes,
		intervals:              intervals,
		maxCandlesPerTimeframe: 50, // Limit stored candles to prevent memory issues
		publishThrottle:        make(map[string]time.Time),
	}

	// Start candle finalization goroutine
	go generator.candleFinalizationLoop()

	return generator
}

// ProcessTrade processes incoming trades and updates all relevant candles
func (g *OHLCVCandleGenerator) ProcessTrade(trade *events.Trade) {
	// CRITICAL VALIDATION: Reject invalid trades immediately
	if trade == nil {
		log.Printf("ERROR: Received nil trade - rejecting")
		return
	}

	if trade.Price <= 0 || trade.Quantity <= 0 {
		log.Printf("🚫 REJECTING INVALID TRADE: %s %s Price=%.8f Quantity=%.8f",
			trade.Exchange, trade.Symbol, trade.Price, trade.Quantity)
		return
	}

	if trade.Exchange == "" || trade.Symbol == "" {
		log.Printf("🚫 REJECTING TRADE WITH MISSING EXCHANGE/SYMBOL: Exchange='%s' Symbol='%s'",
			trade.Exchange, trade.Symbol)
		return
	}

	g.mutex.Lock()
	defer g.mutex.Unlock()

	key := fmt.Sprintf("%s:%s", trade.Exchange, trade.Symbol)

	// Initialize candles for this symbol if not exists
	if _, exists := g.candles[key]; !exists {
		g.candles[key] = make(map[string]*CandleBuilder)
	}

	// Update all timeframe candles
	for _, timeframe := range g.timeframes {
		candle, exists := g.candles[key][timeframe]

		// If candle doesn't exist or the trade is for the next candle period
		if !exists || trade.Timestamp.After(candle.CloseTime) {
			// Finalize the old candle if it exists and was initialized
			if exists && candle.IsInitialized {
				g.finalizeCandle(candle)
			}
			// Create a new candle for the new period
			candle = g.createCandleBuilder(trade.Exchange, trade.Symbol, timeframe, trade.Timestamp)
			g.candles[key][timeframe] = candle
		}

		// Update the current (or new) candle with the trade
		g.updateCandle(candle, trade)
	}
}

// createCandleBuilder creates a new candle builder for the given parameters
func (g *OHLCVCandleGenerator) createCandleBuilder(exchange, symbol, timeframe string, timestamp time.Time) *CandleBuilder {
	interval := g.intervals[timeframe]

	// Align timestamp to candle boundary
	var openTime time.Time
	switch timeframe {
	case "1s", "5s", "15s", "30s":
		openTime = timestamp.Truncate(interval)
	case "1m", "3m", "5m", "15m", "30m":
		openTime = timestamp.Truncate(interval)
	case "1h", "2h", "4h", "6h", "12h":
		openTime = timestamp.Truncate(interval)
	case "1d":
		// Align to UTC midnight
		openTime = time.Date(timestamp.Year(), timestamp.Month(), timestamp.Day(), 0, 0, 0, 0, time.UTC)
	default:
		openTime = timestamp.Truncate(interval)
	}

	return &CandleBuilder{
		Exchange:      exchange,
		Symbol:        symbol,
		Timeframe:     timeframe,
		Interval:      interval,
		OpenTime:      openTime,
		CloseTime:     openTime.Add(interval).Add(-time.Nanosecond),
		IsInitialized: false,
	}
}

// updateCandle updates a candle with new trade data
func (g *OHLCVCandleGenerator) updateCandle(candle *CandleBuilder, trade *events.Trade) {
	candle.mutex.Lock()
	defer candle.mutex.Unlock()

	// The rollover logic has been moved to ProcessTrade.
	// This function now ONLY updates the candle it is given.

	// Initialize or update OHLC values
	if !candle.IsInitialized {
		candle.Open = trade.Price
		candle.High = trade.Price
		candle.Low = trade.Price
		candle.Close = trade.Price
		candle.IsInitialized = true

		log.Printf("🔧 INITIALIZED CANDLE: %s %s %s with price %.8f",
			candle.Exchange, candle.Symbol, candle.Timeframe, trade.Price)
	} else {
		if trade.Price > candle.High {
			candle.High = trade.Price
		}
		if trade.Price < candle.Low {
			candle.Low = trade.Price
		}
		candle.Close = trade.Price
	}

	// Update volume data
	candle.Volume += trade.Quantity
	candle.QuoteVolume += trade.Value
	candle.TradeCount++

	// Update taker buy data
	if trade.Side == "BUY" && !trade.IsBuyerMaker {
		candle.TakerBuyVolume += trade.Quantity
		candle.TakerBuyQuoteVolume += trade.Value
	}

	// Update VWAP calculation
	candle.VWAPSum += trade.Price * trade.Quantity
	candle.VWAPVolume += trade.Quantity
}

// finalizeCandle finalizes a candle and publishes it
func (g *OHLCVCandleGenerator) finalizeCandle(candle *CandleBuilder) {
	if !candle.IsInitialized {
		return
	}

	// CRITICAL VALIDATION: Don't publish invalid candles
	if candle.Open <= 0 || candle.High <= 0 || candle.Low <= 0 || candle.Close <= 0 {
		log.Printf("🚫 REJECTING INVALID CANDLE: %s %s %s O=%.8f H=%.8f L=%.8f C=%.8f",
			candle.Exchange, candle.Symbol, candle.Timeframe,
			candle.Open, candle.High, candle.Low, candle.Close)
		return
	}

	// MEMORY OPTIMIZATION: Throttle publishing to prevent Redis overload
	throttleKey := fmt.Sprintf("%s:%s:%s", candle.Exchange, candle.Symbol, candle.Timeframe)
	g.throttleMutex.Lock()
	lastPublish, exists := g.publishThrottle[throttleKey]
	now := time.Now()

	// Only publish if enough time has passed (minimum 1 second interval)
	if exists && now.Sub(lastPublish) < time.Second {
		g.throttleMutex.Unlock()
		return
	}
	g.publishThrottle[throttleKey] = now
	g.throttleMutex.Unlock()

	// Calculate VWAP
	vwap := float64(0)
	if candle.VWAPVolume > 0 {
		vwap = candle.VWAPSum / candle.VWAPVolume
	}

	// Create OHLCV candle event
	ohlcvCandle := &events.OHLCVCandle{
		Exchange:            candle.Exchange,
		Symbol:              candle.Symbol,
		Timeframe:           candle.Timeframe,
		OpenTime:            candle.OpenTime,
		CloseTime:           candle.CloseTime,
		Open:                candle.Open,
		High:                candle.High,
		Low:                 candle.Low,
		Close:               candle.Close,
		Volume:              candle.Volume,
		QuoteVolume:         candle.QuoteVolume,
		TradeCount:          candle.TradeCount,
		TakerBuyVolume:      candle.TakerBuyVolume,
		TakerBuyQuoteVolume: candle.TakerBuyQuoteVolume,
		VWAP:                vwap,
		IsComplete:          true,
		Timestamp:           time.Now(),
	}

	// FINAL VALIDATION: Absolutely prevent any zero-value candles from being published
	if ohlcvCandle.Open <= 0 || ohlcvCandle.High <= 0 || ohlcvCandle.Low <= 0 || ohlcvCandle.Close <= 0 {
		log.Printf("🚫 FINAL VALIDATION FAILED: Rejecting zero-value candle %s %s %s O=%.8f H=%.8f L=%.8f C=%.8f",
			ohlcvCandle.Exchange, ohlcvCandle.Symbol, ohlcvCandle.Timeframe,
			ohlcvCandle.Open, ohlcvCandle.High, ohlcvCandle.Low, ohlcvCandle.Close)
		return
	}

	// Publish to Redis channel
	channel := fmt.Sprintf("candles:%s:%s", strings.ToUpper(candle.Symbol), candle.Timeframe)

	data, err := json.Marshal(ohlcvCandle)
	if err != nil {
		log.Printf("ERROR: Failed to marshal OHLCV candle: %v", err)
		return
	}

	err = g.redisClient.Publish(context.Background(), channel, string(data)).Err()
	if err != nil {
		log.Printf("ERROR: Failed to publish OHLCV candle: %v", err)
		return
	}

	log.Printf("✅ OHLCV: Published %s %s candle: O=%.4f H=%.4f L=%.4f C=%.4f V=%.2f",
		candle.Symbol, candle.Timeframe, candle.Open, candle.High, candle.Low, candle.Close, candle.Volume)
}

// candleFinalizationLoop runs a periodic check to finalize expired candles
func (g *OHLCVCandleGenerator) candleFinalizationLoop() {
	ticker := time.NewTicker(1 * time.Second) // Check every second
	defer ticker.Stop()

	for {
		select {
		case <-g.ctx.Done():
			return
		case <-ticker.C:
			g.checkExpiredCandles()
		}
	}
}

// checkExpiredCandles checks and finalizes expired candles
func (g *OHLCVCandleGenerator) checkExpiredCandles() {
	g.mutex.Lock()
	defer g.mutex.Unlock()

	now := time.Now()

	for symbolKey, timeframeCandles := range g.candles {
		for timeframe, candle := range timeframeCandles {
			candle.mutex.RLock()
			isExpired := now.After(candle.CloseTime)
			isInitialized := candle.IsInitialized
			hasValidData := candle.Open > 0 && candle.High > 0 && candle.Low > 0 && candle.Close > 0
			candle.mutex.RUnlock()

			if isExpired {
				if isInitialized && hasValidData {
					// Only finalize candles that are both initialized AND have valid data
					g.finalizeCandle(candle)
				} else {
					// Clean up expired candles that are uninitialized or have invalid data
					if !isInitialized {
						log.Printf("🧹 CLEANING UP UNINITIALIZED EXPIRED CANDLE: %s %s %s",
							candle.Exchange, candle.Symbol, candle.Timeframe)
					} else {
						log.Printf("🚫 CLEANING UP INVALID EXPIRED CANDLE: %s %s %s O=%.8f H=%.8f L=%.8f C=%.8f",
							candle.Exchange, candle.Symbol, candle.Timeframe,
							candle.Open, candle.High, candle.Low, candle.Close)
					}
				}

				// Remove the candle from the map regardless
				delete(g.candles[symbolKey], timeframe)
			}
		}
	}
}

// Stop stops the OHLCV candle generator
func (g *OHLCVCandleGenerator) Stop() {
	g.cancel()

	// Finalize all remaining candles
	g.mutex.Lock()
	defer g.mutex.Unlock()

	for _, timeframeCandles := range g.candles {
		for _, candle := range timeframeCandles {
			if candle.IsInitialized {
				g.finalizeCandle(candle)
			}
		}
	}

	log.Println("OHLCV Candle Generator stopped")
}

// GetStats returns statistics about the candle generator
func (g *OHLCVCandleGenerator) GetStats() map[string]interface{} {
	g.mutex.RLock()
	defer g.mutex.RUnlock()

	stats := map[string]interface{}{
		"symbols_tracked": len(g.candles),
		"timeframes":      g.timeframes,
		"active_candles":  0,
	}

	activeCandles := 0
	for _, timeframeCandles := range g.candles {
		for _, candle := range timeframeCandles {
			if candle.IsInitialized {
				activeCandles++
			}
		}
	}
	stats["active_candles"] = activeCandles

	return stats
}
