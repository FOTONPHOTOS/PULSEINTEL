package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"pulseintel/internal/config"
)

// ============================================================================
// PERIODIC SNAPSHOT GENERATOR - ITEM 3: REGULAR BOOK SNAPSHOTS
// ============================================================================

// PeriodicSnapshot represents a timestamped orderbook snapshot
type PeriodicSnapshot struct {
	Exchange       string    `json:"exchange"`
	Symbol         string    `json:"symbol"`
	Bids           []Level   `json:"bids"` // All bid levels
	Asks           []Level   `json:"asks"` // All ask levels
	BestBid        float64   `json:"best_bid"`
	BestAsk        float64   `json:"best_ask"`
	MidPrice       float64   `json:"mid_price"`
	Spread         float64   `json:"spread"`
	TotalBidVolume float64   `json:"total_bid_volume"`
	TotalAskVolume float64   `json:"total_ask_volume"`
	SnapshotID     string    `json:"snapshot_id"`
	SequenceNumber int64     `json:"sequence_number"`
	Timestamp      time.Time `json:"timestamp"`
	IsComplete     bool      `json:"is_complete"`
	LevelCount     int       `json:"level_count"`
}

// PeriodicSnapshotGenerator creates regular orderbook snapshots for recovery
type PeriodicSnapshotGenerator struct {
	redisClient *redis.Client
	cfg         *config.Config
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup

	// Configuration
	snapshotInterval time.Duration
	symbols          []string
	exchanges        []string

	// State tracking
	lastSnapshots   map[string]*PeriodicSnapshot // [exchange:symbol] -> last snapshot
	snapshotCounter int64
	mutex           sync.RWMutex

	// Statistics
	snapshotsGenerated int64
	lastStatsReport    time.Time

	// NEW: Reference to OrderBookAnalyzer
	orderBookAnalyzer *OrderBookAnalyzer
}

// NewPeriodicSnapshotGenerator creates a new periodic snapshot generator
func NewPeriodicSnapshotGenerator(redisClient *redis.Client, cfg *config.Config, analyzer *OrderBookAnalyzer) *PeriodicSnapshotGenerator {
	ctx, cancel := context.WithCancel(context.Background())

	// Default configuration
	snapshotInterval := 1 * time.Second // Default 1 second

	symbols := []string{"SOLUSDT"} // Default symbol
	if len(cfg.Symbols) > 0 {
		symbols = make([]string, 0, len(cfg.Symbols))
		for symbol := range cfg.Symbols {
			symbols = append(symbols, symbol)
		}
	}

	exchanges := []string{"binance", "bybit", "okx"}

	return &PeriodicSnapshotGenerator{
		redisClient:       redisClient,
		cfg:               cfg,
		ctx:               ctx,
		cancel:            cancel,
		snapshotInterval:  snapshotInterval,
		symbols:           symbols,
		exchanges:         exchanges,
		lastSnapshots:     make(map[string]*PeriodicSnapshot),
		lastStatsReport:   time.Now(),
		orderBookAnalyzer: analyzer, // NEW
	}
}

// Start starts the periodic snapshot generator
func (psg *PeriodicSnapshotGenerator) Start() {
	log.Printf("📸 Starting Periodic Snapshot Generator (interval: %v)...", psg.snapshotInterval)

	// Start snapshot generation loop
	psg.wg.Add(1)
	go func() {
		defer psg.wg.Done()
		psg.snapshotGenerationLoop()
	}()

	// Start statistics reporting
	psg.wg.Add(1)
	go func() {
		defer psg.wg.Done()
		psg.statsReportingLoop()
	}()

	log.Println("✅ Periodic Snapshot Generator started")
}

// snapshotGenerationLoop generates snapshots at regular intervals
func (psg *PeriodicSnapshotGenerator) snapshotGenerationLoop() {
	ticker := time.NewTicker(psg.snapshotInterval)
	defer ticker.Stop()

	for {
		select {
		case <-psg.ctx.Done():
			return
		case <-ticker.C:
			psg.generateAllSnapshots()
		}
	}
}

// generateAllSnapshots generates snapshots for all symbols and exchanges
func (psg *PeriodicSnapshotGenerator) generateAllSnapshots() {
	for _, exchange := range psg.exchanges {
		for _, symbol := range psg.symbols {
			psg.generateSnapshot(exchange, symbol)
		}
	}
}

// generateSnapshot generates a snapshot for a specific exchange and symbol
func (psg *PeriodicSnapshotGenerator) generateSnapshot(exchange, symbol string) {
	normSymbol := NormalizeSymbol(symbol)
	timestamp := time.Now()

	psg.mutex.Lock()
	psg.snapshotCounter++
	snapshotID := fmt.Sprintf("%s_%s_%d_%d", exchange, normSymbol, timestamp.Unix(), psg.snapshotCounter)
	psg.mutex.Unlock()

	var bids, asks []Level
	var bestBid, bestAsk, midPrice, spread, totalBidVol, totalAskVol float64
	var levelCount int
	state := psg.orderBookAnalyzer.getOrderBookState(exchange, normSymbol)
	if state != nil {
		state.mutex.RLock()
		bids = psg.orderBookAnalyzer.sortBidsDescending(state.Bids)
		asks = psg.orderBookAnalyzer.sortAsksAscending(state.Asks)
		if len(bids) > 0 {
			bestBid = bids[0].Price
		}
		if len(asks) > 0 {
			bestAsk = asks[0].Price
		}
		if bestBid > 0 && bestAsk > 0 {
			midPrice = (bestBid + bestAsk) / 2
			spread = bestAsk - bestBid
		}
		totalBidVol = psg.orderBookAnalyzer.calculateTotalVolume(bids)
		totalAskVol = psg.orderBookAnalyzer.calculateTotalVolume(asks)
		levelCount = len(bids) + len(asks)
		state.mutex.RUnlock()
		log.Printf("DEBUG: [SNAPSHOT] Live orderbook for %s %s: %d bids, %d asks", exchange, normSymbol, len(bids), len(asks))
	} else {
		log.Printf("DEBUG: [SNAPSHOT] No live orderbook state for %s %s", exchange, normSymbol)
	}
	log.Printf("DEBUG: [SNAPSHOT] Snapshot for %s %s: %d bids, %d asks, level_count=%d", exchange, normSymbol, len(bids), len(asks), levelCount)

	snapshot := &PeriodicSnapshot{
		Exchange:       exchange,
		Symbol:         symbol,
		Bids:           bids,
		Asks:           asks,
		BestBid:        bestBid,
		BestAsk:        bestAsk,
		MidPrice:       midPrice,
		Spread:         spread,
		TotalBidVolume: totalBidVol,
		TotalAskVolume: totalAskVol,
		SnapshotID:     snapshotID,
		SequenceNumber: psg.snapshotCounter,
		Timestamp:      timestamp,
		IsComplete:     true,
		LevelCount:     levelCount,
	}

	log.Printf("DEBUG: [SNAPSHOT] Snapshot for %s %s: %d bids, %d asks, level_count=%d", exchange, normSymbol, len(snapshot.Bids), len(snapshot.Asks), snapshot.LevelCount)

	key := fmt.Sprintf("%s:%s", exchange, symbol)
	psg.mutex.Lock()
	psg.lastSnapshots[key] = snapshot
	psg.snapshotsGenerated++
	psg.mutex.Unlock()

	psg.publishSnapshot(snapshot)

	log.Printf("📸 Snapshot: %s %s - %d levels, ID: %s", exchange, symbol, snapshot.LevelCount, snapshot.SnapshotID)
}

// publishSnapshot publishes snapshot to Redis
func (psg *PeriodicSnapshotGenerator) publishSnapshot(snapshot *PeriodicSnapshot) {
	// Publish to general snapshot channel
	channel := fmt.Sprintf("snapshots:%s:%s", snapshot.Exchange, snapshot.Symbol)

	data, err := json.Marshal(snapshot)
	if err != nil {
		log.Printf("ERROR: Failed to marshal snapshot: %v", err)
		return
	}

	err = psg.redisClient.Publish(psg.ctx, channel, string(data)).Err()
	if err != nil {
		log.Printf("ERROR: Failed to publish snapshot: %v", err)
		return
	}

	// Also store in Redis with expiration for recovery
	key := fmt.Sprintf("snapshot:%s:%s:%d", snapshot.Exchange, snapshot.Symbol, snapshot.Timestamp.Unix())
	err = psg.redisClient.Set(psg.ctx, key, string(data), 24*time.Hour).Err()
	if err != nil {
		log.Printf("ERROR: Failed to store snapshot: %v", err)
		return
	}
}

// statsReportingLoop reports statistics periodically
func (psg *PeriodicSnapshotGenerator) statsReportingLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-psg.ctx.Done():
			return
		case <-ticker.C:
			psg.reportStats()
		}
	}
}

// reportStats reports generator statistics
func (psg *PeriodicSnapshotGenerator) reportStats() {
	psg.mutex.RLock()
	generated := psg.snapshotsGenerated
	tracked := len(psg.lastSnapshots)
	psg.mutex.RUnlock()

	log.Printf("📸 Snapshot Stats: %d generated, %d tracked symbols",
		generated, tracked)
}

// Stop stops the periodic snapshot generator
func (psg *PeriodicSnapshotGenerator) Stop() {
	psg.cancel()
	psg.wg.Wait()
	log.Println("📸 Periodic Snapshot Generator stopped")
}

// GetStats returns generator statistics
func (psg *PeriodicSnapshotGenerator) GetStats() map[string]interface{} {
	psg.mutex.RLock()
	defer psg.mutex.RUnlock()

	return map[string]interface{}{
		"snapshots_generated": psg.snapshotsGenerated,
		"snapshot_interval":   psg.snapshotInterval.String(),
		"symbols_tracked":     len(psg.lastSnapshots),
		"exchanges":           psg.exchanges,
	}
}
