package batcher

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"sync"
	"time"

	"go.uber.org/zap"
)

// BatchedMessage represents a batch of WebSocket messages
type BatchedMessage struct {
	Type      string        `json:"type"`
	Batch     []interface{} `json:"batch"`
	Count     int           `json:"count"`
	Timestamp int64         `json:"timestamp"`
	Compressed bool         `json:"compressed,omitempty"`
}

// MessageBatcher batches messages for efficient transmission
type MessageBatcher struct {
	logger      *zap.Logger
	messages    []interface{}
	mu          sync.Mutex
	timer       *time.Timer
	maxSize     int
	timeout     time.Duration
	maxBytes    int
	compression bool
	outputCh    chan []byte
}

// NewMessageBatcher creates a new message batcher
func NewMessageBatcher(logger *zap.Logger, maxSize int, timeout time.Duration, maxBytes int, compression bool) *MessageBatcher {
	return &MessageBatcher{
		logger:      logger.Named("batcher"),
		messages:    make([]interface{}, 0, maxSize),
		maxSize:     maxSize,
		timeout:     timeout,
		maxBytes:    maxBytes,
		compression: compression,
		outputCh:    make(chan []byte, 100),
	}
}

// Start begins the batching process
func (mb *MessageBatcher) Start() <-chan []byte {
	return mb.outputCh
}

// AddMessage adds a message to the current batch
func (mb *MessageBatcher) AddMessage(message interface{}) {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	mb.messages = append(mb.messages, message)

	// Check if we should flush immediately
	if len(mb.messages) >= mb.maxSize {
		mb.flushBatch()
		return
	}

	// Set timer for timeout flush if not already set
	if mb.timer == nil {
		mb.timer = time.AfterFunc(mb.timeout, func() {
			mb.mu.Lock()
			defer mb.mu.Unlock()
			mb.flushBatch()
		})
	}
}

// flushBatch sends the current batch (must be called with lock held)
func (mb *MessageBatcher) flushBatch() {
	if len(mb.messages) == 0 {
		return
	}

	// Stop timer if running
	if mb.timer != nil {
		mb.timer.Stop()
		mb.timer = nil
	}

	// Create batched message
	batch := BatchedMessage{
		Type:      "batch",
		Batch:     make([]interface{}, len(mb.messages)),
		Count:     len(mb.messages),
		Timestamp: time.Now().UnixMilli(),
	}

	// Copy messages to batch
	copy(batch.Batch, mb.messages)

	// Clear current messages
	mb.messages = mb.messages[:0]

	// Serialize to JSON
	data, err := json.Marshal(batch)
	if err != nil {
		mb.logger.Error("Failed to marshal batch", zap.Error(err))
		return
	}

	// Apply compression if enabled and beneficial
	if mb.compression && len(data) > 1024 { // Only compress if > 1KB
		compressed := mb.compressData(data)
		if len(compressed) < len(data) {
			batch.Compressed = true
			data = compressed
		}
	}

	// Check size limit
	if len(data) > mb.maxBytes {
		mb.logger.Warn("Batch exceeds max size, splitting",
			zap.Int("size", len(data)),
			zap.Int("max", mb.maxBytes),
			zap.Int("count", batch.Count))
		
		// Split batch and retry
		mb.splitAndFlush(batch.Batch)
		return
	}

	// Send to output channel
	select {
	case mb.outputCh <- data:
		mb.logger.Debug("Batch sent",
			zap.Int("count", batch.Count),
			zap.Int("size", len(data)),
			zap.Bool("compressed", batch.Compressed))
	default:
		mb.logger.Warn("Output channel full, dropping batch")
	}
}

// compressData compresses data using gzip
func (mb *MessageBatcher) compressData(data []byte) []byte {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	
	if _, err := gz.Write(data); err != nil {
		mb.logger.Error("Compression failed", zap.Error(err))
		return data
	}
	
	if err := gz.Close(); err != nil {
		mb.logger.Error("Compression close failed", zap.Error(err))
		return data
	}
	
	return buf.Bytes()
}

// splitAndFlush splits a large batch into smaller ones
func (mb *MessageBatcher) splitAndFlush(messages []interface{}) {
	chunkSize := mb.maxSize / 2 // Use smaller chunks
	
	for i := 0; i < len(messages); i += chunkSize {
		end := i + chunkSize
		if end > len(messages) {
			end = len(messages)
		}
		
		chunk := BatchedMessage{
			Type:      "batch",
			Batch:     messages[i:end],
			Count:     end - i,
			Timestamp: time.Now().UnixMilli(),
		}
		
		data, err := json.Marshal(chunk)
		if err != nil {
			mb.logger.Error("Failed to marshal chunk", zap.Error(err))
			continue
		}
		
		select {
		case mb.outputCh <- data:
			mb.logger.Debug("Chunk sent", zap.Int("count", chunk.Count))
		default:
			mb.logger.Warn("Output channel full, dropping chunk")
		}
	}
}

// Close stops the batcher and flushes remaining messages
func (mb *MessageBatcher) Close() {
	mb.mu.Lock()
	defer mb.mu.Unlock()
	
	mb.flushBatch()
	close(mb.outputCh)
}