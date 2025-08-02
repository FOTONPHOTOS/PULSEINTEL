package broadcaster

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"p9_microstream/pkg/batcher"
)

// Broadcaster manages a set of WebSocket connections and broadcasts messages to them.
type Broadcaster struct {
	logger      *zap.Logger
	clients     map[*websocket.Conn]bool
	mu          sync.Mutex
	broadcastCh chan []byte
	registerCh  chan *websocket.Conn
	unregisterCh chan *websocket.Conn
	batcher     *batcher.MessageBatcher
	batchingEnabled bool
}

// NewBroadcaster creates a new Broadcaster.
func NewBroadcaster(logger *zap.Logger) *Broadcaster {
	return NewBroadcasterWithBatching(logger, true) // Enable batching by default
}

// NewBroadcasterWithBatching creates a new Broadcaster with batching option.
func NewBroadcasterWithBatching(logger *zap.Logger, enableBatching bool) *Broadcaster {
	b := &Broadcaster{
		logger:      logger.Named("broadcaster"),
		clients:     make(map[*websocket.Conn]bool),
		broadcastCh: make(chan []byte, 1024), // Buffered channel
		registerCh:  make(chan *websocket.Conn, 100), // Buffered to prevent blocking
		unregisterCh: make(chan *websocket.Conn, 100), // Buffered to prevent blocking
		batchingEnabled: enableBatching,
	}
	
	// Initialize batcher if enabled
	if enableBatching {
		b.batcher = batcher.NewMessageBatcher(
			logger,
			50,                    // maxSize
			100*time.Millisecond,  // timeout
			65536,                 // maxBytes (64KB)
			false,                 // Compression is now handled by the WebSocket transport
		)
		
		// Start batcher and connect to broadcast channel
		batchOutput := b.batcher.Start()
		go func() {
			for batchedData := range batchOutput {
				select {
				case b.broadcastCh <- batchedData:
				default:
					logger.Warn("Broadcast channel full, dropping batched message")
				}
			}
		}()
	}
	
	return b
}

// Run starts the broadcaster's main loop.
func (b *Broadcaster) Run() {
	b.logger.Info("🚀 Broadcaster started")
	for {
		select {
		case client := <-b.registerCh:
			b.mu.Lock()
			b.clients[client] = true
			b.mu.Unlock()
			b.logger.Info("WebSocket client registered", zap.String("remoteAddr", client.RemoteAddr().String()))

		case client := <-b.unregisterCh:
			b.mu.Lock()
			if _, ok := b.clients[client]; ok {
				delete(b.clients, client)
				client.Close()
				b.logger.Info("WebSocket client unregistered", zap.String("remoteAddr", client.RemoteAddr().String()))
			}
			b.mu.Unlock()

		case message := <-b.broadcastCh:
			b.mu.Lock()
			for client := range b.clients {
				if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
					b.logger.Error("Failed to write message to client", zap.Error(err), zap.String("remoteAddr", client.RemoteAddr().String()))
					// Unregister the client if there's an error - NON-BLOCKING
					select {
					case b.unregisterCh <- client:
					default:
						// If unregister channel is full, remove client directly
						delete(b.clients, client)
						client.Close()
						b.logger.Warn("Unregister channel full, removed client directly")
					}
				}
			}
			b.mu.Unlock()
		}
	}
}

// Register adds a new client to the broadcaster.
func (b *Broadcaster) Register(client *websocket.Conn) {
	b.registerCh <- client
}

// Unregister removes a client from the broadcaster.
func (b *Broadcaster) Unregister(client *websocket.Conn) {
	b.unregisterCh <- client
}

// Broadcast sends a message to all registered clients.
func (b *Broadcaster) Broadcast(message []byte) {
	if b.batchingEnabled && b.batcher != nil {
		// Parse message and add to batcher
		var msgData interface{}
		if err := json.Unmarshal(message, &msgData); err == nil {
			b.batcher.AddMessage(msgData)
		} else {
			// Fallback to direct broadcast if parsing fails
			b.directBroadcast(message)
		}
	} else {
		b.directBroadcast(message)
	}
}

// directBroadcast sends message directly without batching
func (b *Broadcaster) directBroadcast(message []byte) {
	select {
	case b.broadcastCh <- message:
	default:
		b.logger.Warn("Broadcast channel is full, dropping message")
	}
}
