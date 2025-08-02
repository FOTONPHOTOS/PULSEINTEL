package publisher

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// PublishMetrics tracks publishing statistics
type PublishMetrics struct {
	TotalEvents      int64         `json:"total_events"`
	SuccessfulEvents int64         `json:"successful_events"`
	FailedEvents     int64         `json:"failed_events"`
	ThrottledEvents  int64         `json:"throttled_events"`
	AverageLatency   time.Duration `json:"average_latency"`
	LastPublish      time.Time     `json:"last_publish"`
}

// RedisPublisher handles publishing events to Redis PubSub with throttling
type RedisPublisher struct {
	client  *redis.Client
	logger  *zap.Logger
	metrics PublishMetrics
	mu      sync.RWMutex
	ctx     context.Context
	cancel  context.CancelFunc

	// Throttling controls
	maxMessagesPerSecond int
	messageCount         int
	lastResetTime        time.Time
	throttleMutex        sync.Mutex
}

// NewRedisPublisher creates a new Redis publisher instance with throttling
func NewRedisPublisher(client *redis.Client, logger *zap.Logger) *RedisPublisher {
	ctx, cancel := context.WithCancel(context.Background())

	return &RedisPublisher{
		client:               client,
		logger:               logger,
		ctx:                  ctx,
		cancel:               cancel,
		maxMessagesPerSecond: 1000, // Increased limit to 1000 messages per second for high-frequency data
		lastResetTime:        time.Now(),
	}
}

// Publish publishes a single event to Redis with throttling
func (rp *RedisPublisher) Publish(channel string, data interface{}) error {
	// Check throttling first
	if !rp.checkThrottle() {
		rp.updateMetrics(false, 0, true) // Mark as throttled
		rp.logger.Debug("Message throttled",
			zap.String("channel", channel))
		return fmt.Errorf("message throttled - rate limit exceeded")
	}

	start := time.Now()

	// Handle different data types - NO DOUBLE JSON ENCODING
	var message string
	switch v := data.(type) {
	case string:
		message = v
	case []byte:
		message = string(v)
	default:
		rp.logger.Error("Unsupported data type for Redis publish",
			zap.String("channel", channel),
			zap.String("type", fmt.Sprintf("%T", data)))
		rp.updateMetrics(false, time.Since(start), false)
		return fmt.Errorf("unsupported data type: %T", data)
	}

	// Publish DIRECTLY to Redis - NO EXTRA PROCESSING
	err := rp.client.Publish(rp.ctx, channel, message).Err()
	if err != nil {
		rp.updateMetrics(false, time.Since(start), false)
		rp.logger.Error("❌ Failed to publish to Redis",
			zap.String("channel", channel),
			zap.Error(err))
		return fmt.Errorf("failed to publish to Redis: %w", err)
	}

	rp.updateMetrics(true, time.Since(start), false)
	rp.logger.Info("✅ REAL DATA PUBLISHED TO REDIS",
		zap.String("channel", channel),
		zap.Duration("latency", time.Since(start)))

	return nil
}

// checkThrottle checks if we can publish based on rate limiting
func (rp *RedisPublisher) checkThrottle() bool {
	rp.throttleMutex.Lock()
	defer rp.throttleMutex.Unlock()

	now := time.Now()

	// Reset counter every second
	if now.Sub(rp.lastResetTime) >= time.Second {
		rp.messageCount = 0
		rp.lastResetTime = now
	}

	// Check if we're under the limit
	if rp.messageCount >= rp.maxMessagesPerSecond {
		return false
	}

	rp.messageCount++
	return true
}

// SetThrottleLimit sets the maximum messages per second
func (rp *RedisPublisher) SetThrottleLimit(limit int) {
	rp.throttleMutex.Lock()
	defer rp.throttleMutex.Unlock()
	rp.maxMessagesPerSecond = limit
	rp.logger.Info("Throttle limit updated", zap.Int("messages_per_second", limit))
}

// updateMetrics updates publishing metrics
func (rp *RedisPublisher) updateMetrics(success bool, latency time.Duration, throttled bool) {
	rp.mu.Lock()
	defer rp.mu.Unlock()

	rp.metrics.TotalEvents++
	if throttled {
		rp.metrics.ThrottledEvents++
		return
	}

	if success {
		rp.metrics.SuccessfulEvents++
	} else {
		rp.metrics.FailedEvents++
	}

	// Update average latency
	if rp.metrics.TotalEvents == 1 {
		rp.metrics.AverageLatency = latency
	} else {
		rp.metrics.AverageLatency = time.Duration(
			(int64(rp.metrics.AverageLatency)*rp.metrics.TotalEvents + int64(latency)) / (rp.metrics.TotalEvents + 1),
		)
	}

	rp.metrics.LastPublish = time.Now()
}

// GetMetrics returns current publishing metrics
func (rp *RedisPublisher) GetMetrics() PublishMetrics {
	rp.mu.RLock()
	defer rp.mu.RUnlock()
	return rp.metrics
}

// Health checks if the Redis publisher is healthy
func (rp *RedisPublisher) Health() bool {
	// Check Redis connectivity
	err := rp.client.Ping(rp.ctx).Err()
	if err != nil {
		rp.logger.Error("Redis health check failed", zap.Error(err))
		return false
	}

	// Check if we've published recently (within last 5 minutes)
	rp.mu.RLock()
	lastPublish := rp.metrics.LastPublish
	rp.mu.RUnlock()

	if time.Since(lastPublish) > 5*time.Minute && rp.metrics.TotalEvents > 0 {
		rp.logger.Warn("No recent publishes detected")
		return false
	}

	return true
}

// Close closes the Redis publisher
func (rp *RedisPublisher) Close() error {
	rp.cancel()
	rp.logger.Info("Redis publisher closed")
	return nil
}
