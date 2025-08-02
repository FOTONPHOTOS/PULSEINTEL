package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Client wraps Redis client with P9_MicroStream specific functionality
type Client struct {
	rdb    *redis.Client
	logger *zap.Logger
	config ClientConfig
}

// ClientConfig holds Redis client configuration
type ClientConfig struct {
	URL          string
	DB           int
	Password     string
	PoolSize     int
	MaxRetries   int
	RetryBackoff time.Duration
}

// Event represents a publishable event
type Event interface {
	GetExchange() string
	GetSymbol() string
	GetTimestamp() time.Time
	GetEventType() string
}

// NewClient creates a new Redis client
func NewClient(config ClientConfig, logger *zap.Logger) (*Client, error) {
	opts := &redis.Options{
		Addr:       config.URL[8:], // Remove "redis://" prefix
		DB:         config.DB,
		Password:   config.Password,
		PoolSize:   config.PoolSize,
		MaxRetries: config.MaxRetries,
	}

	rdb := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	logger.Info("Redis client connected successfully",
		zap.String("addr", opts.Addr),
		zap.Int("db", opts.DB),
		zap.Int("pool_size", opts.PoolSize))

	return &Client{
		rdb:    rdb,
		logger: logger,
		config: config,
	}, nil
}

// Publish publishes an event to a Redis channel
func (c *Client) Publish(ctx context.Context, channel string, event Event) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	if err := c.rdb.Publish(ctx, channel, data).Err(); err != nil {
		c.logger.Error("Failed to publish event",
			zap.String("channel", channel),
			zap.String("exchange", event.GetExchange()),
			zap.String("symbol", event.GetSymbol()),
			zap.String("event_type", event.GetEventType()),
			zap.Error(err))
		return fmt.Errorf("failed to publish to channel %s: %w", channel, err)
	}

	c.logger.Debug("Event published successfully",
		zap.String("channel", channel),
		zap.String("exchange", event.GetExchange()),
		zap.String("symbol", event.GetSymbol()),
		zap.String("event_type", event.GetEventType()))

	return nil
}

// PublishBatch publishes multiple events in a pipeline for better performance
func (c *Client) PublishBatch(ctx context.Context, events map[string][]Event) error {
	if len(events) == 0 {
		return nil
	}

	pipe := c.rdb.Pipeline()

	for channel, eventList := range events {
		for _, event := range eventList {
			data, err := json.Marshal(event)
			if err != nil {
				c.logger.Error("Failed to marshal event in batch",
					zap.String("channel", channel),
					zap.String("exchange", event.GetExchange()),
					zap.String("symbol", event.GetSymbol()),
					zap.Error(err))
				continue
			}
			pipe.Publish(ctx, channel, data)
		}
	}

	if _, err := pipe.Exec(ctx); err != nil {
		c.logger.Error("Failed to execute batch publish", zap.Error(err))
		return fmt.Errorf("failed to execute batch publish: %w", err)
	}

	// Log batch statistics
	totalEvents := 0
	for _, eventList := range events {
		totalEvents += len(eventList)
	}

	c.logger.Info("Batch publish completed",
		zap.Int("channels", len(events)),
		zap.Int("total_events", totalEvents))

	return nil
}

// Subscribe subscribes to Redis channels and returns a channel of messages
func (c *Client) Subscribe(ctx context.Context, channels []string) (<-chan *redis.Message, error) {
	pubsub := c.rdb.Subscribe(ctx, channels...)

	// Wait for subscription confirmation
	_, err := pubsub.Receive(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe to channels: %w", err)
	}

	c.logger.Info("Subscribed to channels", zap.Strings("channels", channels))

	return pubsub.Channel(), nil
}

// Set stores a key-value pair with optional expiration
func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	if err := c.rdb.Set(ctx, key, data, expiration).Err(); err != nil {
		return fmt.Errorf("failed to set key %s: %w", key, err)
	}

	return nil
}

// Get retrieves a value by key
func (c *Client) Get(ctx context.Context, key string, dest interface{}) error {
	data, err := c.rdb.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("key %s not found", key)
		}
		return fmt.Errorf("failed to get key %s: %w", key, err)
	}

	if err := json.Unmarshal([]byte(data), dest); err != nil {
		return fmt.Errorf("failed to unmarshal value for key %s: %w", key, err)
	}

	return nil
}

// XAdd adds an entry to a Redis stream
func (c *Client) XAdd(ctx context.Context, stream string, values map[string]interface{}) error {
	args := &redis.XAddArgs{
		Stream: stream,
		Values: values,
	}

	if err := c.rdb.XAdd(ctx, args).Err(); err != nil {
		return fmt.Errorf("failed to add to stream %s: %w", stream, err)
	}

	return nil
}

// XRead reads from Redis streams
func (c *Client) XRead(ctx context.Context, streams map[string]string) ([]redis.XStream, error) {
	args := &redis.XReadArgs{
		Streams: make([]string, 0, len(streams)*2),
		Block:   time.Second,
	}

	for stream, id := range streams {
		args.Streams = append(args.Streams, stream, id)
	}

	result, err := c.rdb.XRead(ctx, args).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // No new messages
		}
		return nil, fmt.Errorf("failed to read from streams: %w", err)
	}

	return result, nil
}

// HealthCheck performs a health check on the Redis connection
func (c *Client) HealthCheck(ctx context.Context) error {
	if err := c.rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis health check failed: %w", err)
	}
	return nil
}

// GetStats returns Redis connection statistics
func (c *Client) GetStats() map[string]interface{} {
	stats := c.rdb.PoolStats()
	return map[string]interface{}{
		"hits":         stats.Hits,
		"misses":       stats.Misses,
		"timeouts":     stats.Timeouts,
		"total_conns":  stats.TotalConns,
		"idle_conns":   stats.IdleConns,
		"stale_conns":  stats.StaleConns,
	}
}

// Close closes the Redis client connection
func (c *Client) Close() error {
	if err := c.rdb.Close(); err != nil {
		c.logger.Error("Failed to close Redis client", zap.Error(err))
		return err
	}

	c.logger.Info("Redis client closed successfully")
	return nil
}

// BuildChannelName builds a standardized channel name
func BuildChannelName(exchange, symbol, eventType string) string {
	return fmt.Sprintf("%s:%s:%s", exchange, symbol, eventType)
}

// BuildStreamName builds a standardized stream name
func BuildStreamName(exchange, symbol string) string {
	return fmt.Sprintf("stream:%s:%s", exchange, symbol)
}
