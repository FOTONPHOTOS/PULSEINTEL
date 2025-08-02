package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"pulseintel/internal/events"

	"github.com/redis/go-redis/v9"
)

// ============================================================================
// BOOK TICKER AGGREGATOR - ITEM 13: ORDER-BOOK IMBALANCE/LADDER EVENTS
// ============================================================================

// BookTicker represents a consolidated Level-1 order book view.
type BookTicker struct {
	Exchange      string    `json:"exchange"`
	Symbol        string    `json:"symbol"`
	BestBid       float64   `json:"best_bid"`
	BestBidSize   float64   `json:"best_bid_size"`
	BestAsk       float64   `json:"best_ask"`
	BestAskSize   float64   `json:"best_ask_size"`
	Spread        float64   `json:"spread"`
	SpreadPercent float64   `json:"spread_percent"`
	MidPrice      float64   `json:"mid_price"`
	Imbalance     float64   `json:"imbalance"` // Ratio of buy volume to total volume at top of book
	UpdateID      int64     `json:"update_id,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// bookState holds the current top-of-book for a single symbol.
type bookState struct {
	BestBid     float64
	BestBidSize float64
	BestAsk     float64
	BestAskSize float64
	UpdateID    int64
	LastUpdate  time.Time
}

// BookTickerAggregator consumes depth updates and produces a periodic book ticker.
type BookTickerAggregator struct {
	redisClient      *redis.Client
	ctx              context.Context
	cancel           context.CancelFunc
	wg               sync.WaitGroup
	mu               sync.RWMutex
	tickerStates     map[string]*bookState // Key: "exchange:symbol"
	publishInterval  time.Duration
	tickersProcessed uint64
}

// NewBookTickerAggregator creates a new aggregator instance.
func NewBookTickerAggregator(redisClient *redis.Client) *BookTickerAggregator {
	ctx, cancel := context.WithCancel(context.Background())
	return &BookTickerAggregator{
		redisClient:     redisClient,
		ctx:             ctx,
		cancel:          cancel,
		tickerStates:    make(map[string]*bookState),
		publishInterval: 200 * time.Millisecond, // Publish 5 times per second
	}
}

// ProcessDepthUpdate receives a depth update and updates the internal state.
func (bta *BookTickerAggregator) ProcessDepthUpdate(event *events.OrderBookDelta) {
	if event == nil || (len(event.Bids) == 0 && len(event.Asks) == 0) {
		return
	}

	key := fmt.Sprintf("%s:%s", event.Exchange, event.Symbol)

	bta.mu.Lock()
	defer bta.mu.Unlock()

	state, exists := bta.tickerStates[key]
	if !exists {
		state = &bookState{}
		bta.tickerStates[key] = state
	}

	// Update with the best bid (highest price) from the update
	if len(event.Bids) > 0 {
		bestBid, _ := strconv.ParseFloat(event.Bids[0][0], 64)
		bestBidSize, _ := strconv.ParseFloat(event.Bids[0][1], 64)
		if bestBid > 0 {
			state.BestBid = bestBid
			state.BestBidSize = bestBidSize
		}
	}

	// Update with the best ask (lowest price) from the update
	if len(event.Asks) > 0 {
		bestAsk, _ := strconv.ParseFloat(event.Asks[0][0], 64)
		bestAskSize, _ := strconv.ParseFloat(event.Asks[0][1], 64)
		if bestAsk > 0 {
			state.BestAsk = bestAsk
			state.BestAskSize = bestAskSize
		}
	}

	state.LastUpdate = time.Now()
	bta.tickersProcessed++
}

// Run starts the aggregator's publishing loop.
func (bta *BookTickerAggregator) Run() {
	log.Println("✅ Book Ticker Aggregator started")
	bta.wg.Add(1)
	defer bta.wg.Done()

	ticker := time.NewTicker(bta.publishInterval)
	defer ticker.Stop()

	for {
		select {
		case <-bta.ctx.Done():
			return
		case <-ticker.C:
			bta.publishBookTickers()
		}
	}
}

// publishBookTickers iterates through states and publishes tickers to Redis.
func (bta *BookTickerAggregator) publishBookTickers() {
	bta.mu.RLock()
	defer bta.mu.RUnlock()

	for key, state := range bta.tickerStates {
		if state.BestBid > 0 && state.BestAsk > 0 {
			exchange, symbol, _ := bta.parseKey(key)

			spread := state.BestAsk - state.BestBid
			midPrice := (state.BestBid + state.BestAsk) / 2
			spreadPercent := (spread / midPrice) * 100

			// Calculate imbalance: (bid size) / (bid size + ask size)
			totalSize := state.BestBidSize + state.BestAskSize
			imbalance := 0.0
			if totalSize > 0 {
				imbalance = state.BestBidSize / totalSize
			}

			bookTicker := &BookTicker{
				Exchange:      exchange,
				Symbol:        symbol,
				BestBid:       state.BestBid,
				BestBidSize:   state.BestBidSize,
				BestAsk:       state.BestAsk,
				BestAskSize:   state.BestAskSize,
				Spread:        spread,
				SpreadPercent: spreadPercent,
				MidPrice:      midPrice,
				Imbalance:     imbalance,
				Timestamp:     time.Now(),
			}

			bta.publishToRedis(bookTicker)
		}
	}
}

func (bta *BookTickerAggregator) publishToRedis(ticker *BookTicker) {
	channel := fmt.Sprintf("book_ticker:%s:%s", ticker.Exchange, ticker.Symbol)
	payload, err := json.Marshal(ticker)
	if err != nil {
		log.Printf("ERROR: Failed to marshal book ticker for %s: %v", ticker.Symbol, err)
		return
	}

	if err := bta.redisClient.Publish(bta.ctx, channel, payload).Err(); err != nil {
		log.Printf("ERROR: Failed to publish book ticker to Redis for %s: %v", ticker.Symbol, err)
	}
}

func (bta *BookTickerAggregator) parseKey(key string) (string, string, error) {
	parts := strings.Split(key, ":")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid key format: %s", key)
	}
	return parts[0], parts[1], nil
}

// Stop gracefully shuts down the aggregator.
func (bta *BookTickerAggregator) Stop() {
	log.Println("Stopping Book Ticker Aggregator...")
	bta.cancel()
	bta.wg.Wait()
	log.Println("Book Ticker Aggregator stopped.")
}
