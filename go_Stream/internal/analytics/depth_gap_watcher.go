package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// DepthGapWatcher monitors sequence validation and detects gaps in order book updates
type DepthGapWatcher struct {
	redisClient *redis.Client
	symbols     []string
	exchanges   []string
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup

	// Sequence tracking per exchange/symbol
	sequenceTrackers map[string]*SequenceTracker
	mutex            sync.RWMutex

	// Configuration
	maxGapSize      int64
	gapTimeout      time.Duration
	snapshotChannel string
}

// SequenceTracker tracks sequence numbers and detects gaps for a specific exchange/symbol pair
type SequenceTracker struct {
	Exchange       string    `json:"exchange"`
	Symbol         string    `json:"symbol"`
	LastSequence   int64     `json:"last_sequence"`
	LastUpdateTime time.Time `json:"last_update_time"`
	GapCount       int64     `json:"gap_count"`
	TotalUpdates   int64     `json:"total_updates"`
	LargestGap     int64     `json:"largest_gap"`
	LastGapTime    time.Time `json:"last_gap_time"`
}

// GapDetectionEvent represents a detected gap that requires attention
type GapDetectionEvent struct {
	Exchange         string    `json:"exchange"`
	Symbol           string    `json:"symbol"`
	ExpectedSequence int64     `json:"expected_sequence"`
	ReceivedSequence int64     `json:"received_sequence"`
	GapSize          int64     `json:"gap_size"`
	Timestamp        time.Time `json:"timestamp"`
	Action           string    `json:"action"` // "SNAPSHOT_REQUEST", "LOG_WARNING", "CRITICAL_GAP"
}

// SnapshotRequest represents a request for a full order book snapshot
type SnapshotRequest struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Reason    string    `json:"reason"`
	GapSize   int64     `json:"gap_size"`
	Timestamp time.Time `json:"timestamp"`
	Priority  string    `json:"priority"` // "HIGH", "MEDIUM", "LOW"
}

// NewDepthGapWatcher creates a new depth gap watcher
func NewDepthGapWatcher(redisClient *redis.Client, symbols []string) *DepthGapWatcher {
	ctx, cancel := context.WithCancel(context.Background())

	exchanges := []string{"binance", "bybit", "okx"}

	// Initialize sequence trackers for each exchange/symbol combination
	sequenceTrackers := make(map[string]*SequenceTracker)
	for _, exchange := range exchanges {
		for _, symbol := range symbols {
			key := fmt.Sprintf("%s:%s", exchange, symbol)
			sequenceTrackers[key] = &SequenceTracker{
				Exchange:       exchange,
				Symbol:         symbol,
				LastSequence:   -1, // Start with -1 to indicate no data received yet
				LastUpdateTime: time.Now(),
				GapCount:       0,
				TotalUpdates:   0,
				LargestGap:     0,
			}
		}
	}

	return &DepthGapWatcher{
		redisClient:      redisClient,
		symbols:          symbols,
		exchanges:        exchanges,
		ctx:              ctx,
		cancel:           cancel,
		sequenceTrackers: sequenceTrackers,
		maxGapSize:       10,               // Trigger snapshot request if gap > 10
		gapTimeout:       30 * time.Second, // Trigger if no updates for 30s
		snapshotChannel:  "snapshot_requests",
	}
}

// Start begins monitoring for sequence gaps
func (d *DepthGapWatcher) Start() {
	log.Printf("🚀 Starting Depth Gap Watcher - monitoring %d exchanges × %d symbols", len(d.exchanges), len(d.symbols))

	// Start monitoring each exchange/symbol combination
	for _, exchange := range d.exchanges {
		for _, symbol := range d.symbols {
			d.wg.Add(1)
			go d.monitorExchangeSymbol(exchange, symbol)
		}
	}

	// Start periodic health check
	d.wg.Add(1)
	go d.periodicHealthCheck()

	// Start statistics reporting
	d.wg.Add(1)
	go d.statisticsReporter()

	log.Printf("✅ Depth Gap Watcher started - monitoring %d streams", len(d.exchanges)*len(d.symbols))
}

// Stop stops the gap watcher
func (d *DepthGapWatcher) Stop() {
	log.Println("🛑 Stopping Depth Gap Watcher...")
	d.cancel()
	d.wg.Wait()
	log.Println("✅ Depth Gap Watcher stopped")
}

// monitorExchangeSymbol monitors a specific exchange/symbol combination for gaps
func (d *DepthGapWatcher) monitorExchangeSymbol(exchange, symbol string) {
	defer d.wg.Done()

	// Subscribe to depth updates for this exchange/symbol
	depthChannel := fmt.Sprintf("depth:%s:%s", exchange, symbol)
	pubsub := d.redisClient.Subscribe(d.ctx, depthChannel)
	defer pubsub.Close()

	log.Printf("📡 Monitoring depth updates: %s", depthChannel)

	ch := pubsub.Channel()
	for {
		select {
		case <-d.ctx.Done():
			return
		case msg := <-ch:
			d.processDepthUpdate(exchange, symbol, msg.Payload)
		}
	}
}

// processDepthUpdate processes a depth update and checks for sequence gaps
func (d *DepthGapWatcher) processDepthUpdate(exchange, symbol, payload string) {
	// Parse the depth update to extract sequence number
	var depthData map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &depthData); err != nil {
		log.Printf("❌ Error parsing depth update for %s:%s - %v", exchange, symbol, err)
		return
	}

	// Extract sequence number based on exchange format
	sequence := d.extractSequenceNumber(exchange, depthData)
	if sequence == -1 {
		// No sequence number available for this exchange
		return
	}

	// Update sequence tracker
	key := fmt.Sprintf("%s:%s", exchange, symbol)
	d.mutex.Lock()
	tracker := d.sequenceTrackers[key]

	// Check for gaps
	if tracker.LastSequence != -1 {
		expectedSequence := tracker.LastSequence + 1

		if sequence > expectedSequence {
			// Gap detected!
			gapSize := sequence - expectedSequence
			tracker.GapCount++
			if gapSize > tracker.LargestGap {
				tracker.LargestGap = gapSize
			}
			tracker.LastGapTime = time.Now()

			// Create gap detection event
			gapEvent := &GapDetectionEvent{
				Exchange:         exchange,
				Symbol:           symbol,
				ExpectedSequence: expectedSequence,
				ReceivedSequence: sequence,
				GapSize:          gapSize,
				Timestamp:        time.Now(),
				Action:           d.determineGapAction(gapSize),
			}

			d.mutex.Unlock()
			d.handleGapDetection(gapEvent)
			d.mutex.Lock()
		} else if sequence < tracker.LastSequence {
			// Out of order update (might be a duplicate or delayed message)
			log.Printf("⚠️ Out-of-order update: %s:%s expected >= %d, got %d",
				exchange, symbol, tracker.LastSequence, sequence)
		}
	}

	// Update tracker
	tracker.LastSequence = sequence
	tracker.LastUpdateTime = time.Now()
	tracker.TotalUpdates++

	d.mutex.Unlock()
}

// extractSequenceNumber extracts sequence number from depth update based on exchange format
func (d *DepthGapWatcher) extractSequenceNumber(exchange string, data map[string]interface{}) int64 {
	switch exchange {
	case "binance":
		// Binance uses 'u' for update ID and 'U' for first update ID
		if u, ok := data["u"].(float64); ok {
			return int64(u)
		}
		if lastUpdateId, ok := data["lastUpdateId"].(float64); ok {
			return int64(lastUpdateId)
		}

	case "bybit":
		// Bybit uses 'u' for update ID
		if u, ok := data["u"].(float64); ok {
			return int64(u)
		}

	case "okx":
		// OKX uses 'seqId' for sequence ID
		if seqId, ok := data["seqId"].(float64); ok {
			return int64(seqId)
		}
		// Some OKX messages use 'seq'
		if seq, ok := data["seq"].(float64); ok {
			return int64(seq)
		}
	}

	// No sequence number found
	return -1
}

// determineGapAction determines what action to take based on gap size
func (d *DepthGapWatcher) determineGapAction(gapSize int64) string {
	if gapSize >= 100 {
		return "CRITICAL_GAP"
	} else if gapSize >= d.maxGapSize {
		return "SNAPSHOT_REQUEST"
	} else {
		return "LOG_WARNING"
	}
}

// handleGapDetection handles a detected gap based on its severity
func (d *DepthGapWatcher) handleGapDetection(event *GapDetectionEvent) {
	// Log the gap
	log.Printf("🔍 GAP DETECTED: %s:%s gap=%d (expected=%d, received=%d) action=%s",
		event.Exchange, event.Symbol, event.GapSize,
		event.ExpectedSequence, event.ReceivedSequence, event.Action)

	// Publish gap detection event
	gapChannel := "gap_detection"
	eventData, _ := json.Marshal(event)
	d.redisClient.Publish(d.ctx, gapChannel, eventData)

	// Take action based on gap severity
	switch event.Action {
	case "SNAPSHOT_REQUEST":
		d.requestSnapshot(event.Exchange, event.Symbol, event.GapSize, "MEDIUM")

	case "CRITICAL_GAP":
		d.requestSnapshot(event.Exchange, event.Symbol, event.GapSize, "HIGH")
		log.Printf("🚨 CRITICAL GAP: %s:%s gap=%d - immediate snapshot requested",
			event.Exchange, event.Symbol, event.GapSize)

	case "LOG_WARNING":
		// Just log - no snapshot needed for small gaps
		log.Printf("⚠️ Small gap detected: %s:%s gap=%d",
			event.Exchange, event.Symbol, event.GapSize)
	}
}

// requestSnapshot requests a full order book snapshot
func (d *DepthGapWatcher) requestSnapshot(exchange, symbol string, gapSize int64, priority string) {
	snapshotReq := &SnapshotRequest{
		Exchange:  exchange,
		Symbol:    symbol,
		Reason:    fmt.Sprintf("Gap detected: %d missing updates", gapSize),
		GapSize:   gapSize,
		Timestamp: time.Now(),
		Priority:  priority,
	}

	// Publish snapshot request
	reqData, _ := json.Marshal(snapshotReq)
	if err := d.redisClient.Publish(d.ctx, d.snapshotChannel, reqData).Err(); err != nil {
		log.Printf("❌ Error publishing snapshot request: %v", err)
		return
	}

	log.Printf("📸 Snapshot requested: %s:%s (gap=%d, priority=%s)",
		exchange, symbol, gapSize, priority)
}

// periodicHealthCheck performs periodic health checks for stale connections
func (d *DepthGapWatcher) periodicHealthCheck() {
	defer d.wg.Done()

	ticker := time.NewTicker(d.gapTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			d.checkForStaleConnections()
		}
	}
}

// checkForStaleConnections checks for connections that haven't received updates
func (d *DepthGapWatcher) checkForStaleConnections() {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	now := time.Now()
	for key, tracker := range d.sequenceTrackers {
		timeSinceUpdate := now.Sub(tracker.LastUpdateTime)

		if timeSinceUpdate > d.gapTimeout && tracker.TotalUpdates > 0 {
			log.Printf("🔌 Stale connection detected: %s (no updates for %v)",
				key, timeSinceUpdate)

			// Request snapshot for stale connection
			d.requestSnapshot(tracker.Exchange, tracker.Symbol, 0, "LOW")
		}
	}
}

// statisticsReporter reports gap detection statistics periodically
func (d *DepthGapWatcher) statisticsReporter() {
	defer d.wg.Done()

	ticker := time.NewTicker(60 * time.Second) // Report every minute
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			d.reportStatistics()
		}
	}
}

// reportStatistics reports current gap detection statistics
func (d *DepthGapWatcher) reportStatistics() {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	totalUpdates := int64(0)
	totalGaps := int64(0)
	largestGap := int64(0)

	log.Println("📊 === GAP DETECTION STATISTICS ===")
	for key, tracker := range d.sequenceTrackers {
		totalUpdates += tracker.TotalUpdates
		totalGaps += tracker.GapCount
		if tracker.LargestGap > largestGap {
			largestGap = tracker.LargestGap
		}

		if tracker.TotalUpdates > 0 {
			gapRate := float64(tracker.GapCount) / float64(tracker.TotalUpdates) * 100
			log.Printf("   %s: %d updates, %d gaps (%.2f%%), largest gap: %d",
				key, tracker.TotalUpdates, tracker.GapCount, gapRate, tracker.LargestGap)
		}
	}

	if totalUpdates > 0 {
		overallGapRate := float64(totalGaps) / float64(totalUpdates) * 100
		log.Printf("   OVERALL: %d updates, %d gaps (%.2f%%), largest gap: %d",
			totalUpdates, totalGaps, overallGapRate, largestGap)
	}
	log.Println("=========================================")
}

// GetStatistics returns current gap detection statistics
func (d *DepthGapWatcher) GetStatistics() map[string]interface{} {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	stats := make(map[string]interface{})
	for key, tracker := range d.sequenceTrackers {
		stats[key] = map[string]interface{}{
			"total_updates": tracker.TotalUpdates,
			"gap_count":     tracker.GapCount,
			"largest_gap":   tracker.LargestGap,
			"last_sequence": tracker.LastSequence,
			"last_update":   tracker.LastUpdateTime,
		}
	}

	return stats
}
