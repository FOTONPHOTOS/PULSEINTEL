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
// REDIS PUBLISH CONFIRMER - ITEM 26: REDIS PUBLISH-CONFIRM/RETRY
// ============================================================================

// PublishMessage represents a message to be published with confirmation
type PublishMessage struct {
	Channel     string      `json:"channel"`
	Data        interface{} `json:"data"`
	MessageID   string      `json:"message_id"`
	Timestamp   time.Time   `json:"timestamp"`
	Attempts    int         `json:"attempts"`
	MaxAttempts int         `json:"max_attempts"`
	Priority    string      `json:"priority"` // "LOW", "MEDIUM", "HIGH", "CRITICAL"
}

// PublishResult represents the result of a publish operation
type PublishResult struct {
	MessageID string        `json:"message_id"`
	Channel   string        `json:"channel"`
	Success   bool          `json:"success"`
	Attempts  int           `json:"attempts"`
	Error     string        `json:"error,omitempty"`
	Timestamp time.Time     `json:"timestamp"`
	Duration  time.Duration `json:"duration"`
}

// RedisPublishConfirmer provides reliable Redis publishing with confirmation and retry
type RedisPublishConfirmer struct {
	redisClient *redis.Client
	cfg         *config.Config
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup

	// Configuration
	maxRetries     int
	retryDelay     time.Duration
	confirmTimeout time.Duration

	// Message queues by priority
	criticalQueue chan *PublishMessage
	highQueue     chan *PublishMessage
	mediumQueue   chan *PublishMessage
	lowQueue      chan *PublishMessage

	// State tracking
	pendingMessages map[string]*PublishMessage // [message_id] -> message
	results         map[string]*PublishResult  // [message_id] -> result
	mutex           sync.RWMutex

	// Statistics
	messagesPublished int64
	messagesConfirmed int64
	messagesFailed    int64
	retriesExecuted   int64
	lastStatsReport   time.Time
}

// NewRedisPublishConfirmer creates a new Redis publish confirmer
func NewRedisPublishConfirmer(redisClient *redis.Client, cfg *config.Config) *RedisPublishConfirmer {
	ctx, cancel := context.WithCancel(context.Background())

	return &RedisPublishConfirmer{
		redisClient:     redisClient,
		cfg:             cfg,
		ctx:             ctx,
		cancel:          cancel,
		maxRetries:      3,
		retryDelay:      500 * time.Millisecond,
		confirmTimeout:  5 * time.Second,
		criticalQueue:   make(chan *PublishMessage, 1000),
		highQueue:       make(chan *PublishMessage, 1000),
		mediumQueue:     make(chan *PublishMessage, 1000),
		lowQueue:        make(chan *PublishMessage, 1000),
		pendingMessages: make(map[string]*PublishMessage),
		results:         make(map[string]*PublishResult),
		lastStatsReport: time.Now(),
	}
}

// Start starts the Redis publish confirmer
func (rpc *RedisPublishConfirmer) Start() {
	log.Println("📤 Starting Redis Publish Confirmer...")

	// Start priority-based publish workers
	for i := 0; i < 2; i++ {
		rpc.wg.Add(4)
		go func() {
			defer rpc.wg.Done()
			rpc.publishWorker(rpc.criticalQueue, "CRITICAL")
		}()
		go func() {
			defer rpc.wg.Done()
			rpc.publishWorker(rpc.highQueue, "HIGH")
		}()
		go func() {
			defer rpc.wg.Done()
			rpc.publishWorker(rpc.mediumQueue, "MEDIUM")
		}()
		go func() {
			defer rpc.wg.Done()
			rpc.publishWorker(rpc.lowQueue, "LOW")
		}()
	}

	// Start statistics reporting
	rpc.wg.Add(1)
	go func() {
		defer rpc.wg.Done()
		rpc.statsReportingLoop()
	}()

	log.Println("✅ Redis Publish Confirmer started")
}

// PublishWithConfirm publishes a message with confirmation and retry
func (rpc *RedisPublishConfirmer) PublishWithConfirm(channel string, data interface{}, priority string) string {
	messageID := rpc.generateMessageID()

	message := &PublishMessage{
		Channel:     channel,
		Data:        data,
		MessageID:   messageID,
		Timestamp:   time.Now(),
		Attempts:    0,
		MaxAttempts: rpc.maxRetries,
		Priority:    priority,
	}

	// Store message as pending
	rpc.mutex.Lock()
	rpc.pendingMessages[messageID] = message
	rpc.mutex.Unlock()

	// Queue message based on priority
	rpc.queueMessage(message)

	return messageID
}

// queueMessage queues a message based on its priority
func (rpc *RedisPublishConfirmer) queueMessage(message *PublishMessage) {
	select {
	case <-rpc.ctx.Done():
		return
	default:
		switch message.Priority {
		case "CRITICAL":
			select {
			case rpc.criticalQueue <- message:
			case <-rpc.ctx.Done():
			}
		case "HIGH":
			select {
			case rpc.highQueue <- message:
			case <-rpc.ctx.Done():
			}
		case "MEDIUM":
			select {
			case rpc.mediumQueue <- message:
			case <-rpc.ctx.Done():
			}
		default:
			select {
			case rpc.lowQueue <- message:
			case <-rpc.ctx.Done():
			}
		}
	}
}

// publishWorker processes messages from a specific priority queue
func (rpc *RedisPublishConfirmer) publishWorker(queue chan *PublishMessage, priority string) {
	_ = priority // Mark as used to avoid compiler warning (reserved for worker identification)
	for {
		select {
		case <-rpc.ctx.Done():
			return
		case message := <-queue:
			rpc.processMessage(message)
		}
	}
}

// processMessage processes a single message
func (rpc *RedisPublishConfirmer) processMessage(message *PublishMessage) {
	startTime := time.Now()
	message.Attempts++

	// Serialize data
	data, err := json.Marshal(message.Data)
	if err != nil {
		rpc.recordFailure(message, fmt.Sprintf("JSON marshal error: %v", err), startTime)
		return
	}

	// Attempt to publish
	ctx, cancel := context.WithTimeout(rpc.ctx, rpc.confirmTimeout)
	defer cancel()

	err = rpc.redisClient.Publish(ctx, message.Channel, string(data)).Err()
	if err != nil {
		rpc.recordFailure(message, fmt.Sprintf("Redis publish error: %v", err), startTime)
		rpc.scheduleRetry(message)
		return
	}

	// Success
	rpc.recordSuccess(message, startTime)
}

// recordSuccess records a successful publish
func (rpc *RedisPublishConfirmer) recordSuccess(message *PublishMessage, startTime time.Time) {
	duration := time.Since(startTime)

	result := &PublishResult{
		MessageID: message.MessageID,
		Channel:   message.Channel,
		Success:   true,
		Attempts:  message.Attempts,
		Timestamp: time.Now(),
		Duration:  duration,
	}

	rpc.mutex.Lock()
	rpc.results[message.MessageID] = result
	delete(rpc.pendingMessages, message.MessageID)
	rpc.messagesPublished++
	rpc.messagesConfirmed++
	rpc.mutex.Unlock()

	log.Printf("📤 Published: %s (attempt %d, %v)",
		message.Channel, message.Attempts, duration)
}

// recordFailure records a failed publish
func (rpc *RedisPublishConfirmer) recordFailure(message *PublishMessage, errorMsg string, startTime time.Time) {
	duration := time.Since(startTime)

	result := &PublishResult{
		MessageID: message.MessageID,
		Channel:   message.Channel,
		Success:   false,
		Attempts:  message.Attempts,
		Error:     errorMsg,
		Timestamp: time.Now(),
		Duration:  duration,
	}

	rpc.mutex.Lock()
	rpc.results[message.MessageID] = result
	if message.Attempts >= message.MaxAttempts {
		delete(rpc.pendingMessages, message.MessageID)
		rpc.messagesFailed++
	}
	rpc.mutex.Unlock()

	log.Printf("❌ Publish failed: %s (attempt %d/%d) - %s",
		message.Channel, message.Attempts, message.MaxAttempts, errorMsg)
}

// scheduleRetry schedules a message for retry if attempts remain
func (rpc *RedisPublishConfirmer) scheduleRetry(message *PublishMessage) {
	if message.Attempts >= message.MaxAttempts {
		return // Max attempts reached
	}

	rpc.mutex.Lock()
	rpc.retriesExecuted++
	rpc.mutex.Unlock()

	// Schedule retry with exponential backoff
	delay := rpc.retryDelay * time.Duration(message.Attempts)

	go func() {
		select {
		case <-rpc.ctx.Done():
			return
		case <-time.After(delay):
			rpc.queueMessage(message)
		}
	}()
}

// generateMessageID generates a unique message ID
func (rpc *RedisPublishConfirmer) generateMessageID() string {
	return fmt.Sprintf("msg_%d_%d", time.Now().UnixNano(), len(rpc.pendingMessages))
}

// GetPublishResult returns the result for a specific message ID
func (rpc *RedisPublishConfirmer) GetPublishResult(messageID string) *PublishResult {
	rpc.mutex.RLock()
	defer rpc.mutex.RUnlock()
	return rpc.results[messageID]
}

// statsReportingLoop reports statistics periodically
func (rpc *RedisPublishConfirmer) statsReportingLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-rpc.ctx.Done():
			return
		case <-ticker.C:
			rpc.reportStats()
		}
	}
}

// reportStats reports confirmer statistics
func (rpc *RedisPublishConfirmer) reportStats() {
	rpc.mutex.RLock()
	published := rpc.messagesPublished
	confirmed := rpc.messagesConfirmed
	failed := rpc.messagesFailed
	retries := rpc.retriesExecuted
	pending := len(rpc.pendingMessages)
	rpc.mutex.RUnlock()

	successRate := float64(0)
	if published > 0 {
		successRate = (float64(confirmed) / float64(published)) * 100
	}

	log.Printf("📤 Publish Stats: %d published, %d confirmed (%.1f%%), %d failed, %d retries, %d pending",
		published, confirmed, successRate, failed, retries, pending)
}

// Stop stops the Redis publish confirmer
func (rpc *RedisPublishConfirmer) Stop() {
	rpc.cancel()
	rpc.wg.Wait()
	log.Println("📤 Redis Publish Confirmer stopped")
}

// GetStats returns confirmer statistics
func (rpc *RedisPublishConfirmer) GetStats() map[string]interface{} {
	rpc.mutex.RLock()
	defer rpc.mutex.RUnlock()

	successRate := float64(0)
	if rpc.messagesPublished > 0 {
		successRate = (float64(rpc.messagesConfirmed) / float64(rpc.messagesPublished)) * 100
	}

	return map[string]interface{}{
		"messages_published": rpc.messagesPublished,
		"messages_confirmed": rpc.messagesConfirmed,
		"messages_failed":    rpc.messagesFailed,
		"retries_executed":   rpc.retriesExecuted,
		"pending_messages":   len(rpc.pendingMessages),
		"success_rate":       successRate,
		"max_retries":        rpc.maxRetries,
	}
}
