package metrics

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// PrometheusMetrics handles all Prometheus metrics for P9-MicroStream
type PrometheusMetrics struct {
	// Gap Detection Metrics
	GapsDetected     *prometheus.CounterVec
	GapSizes         *prometheus.HistogramVec
	SnapshotRequests *prometheus.CounterVec

	// Pipeline Metrics
	MessagesProcessed *prometheus.CounterVec
	ProcessingLatency *prometheus.HistogramVec
	ActiveConnections *prometheus.GaugeVec

	// Exchange Metrics
	ExchangeStatus      *prometheus.GaugeVec
	WebSocketReconnects *prometheus.CounterVec

	// Service Health
	ServiceUptime   *prometheus.GaugeVec
	RedisOperations *prometheus.CounterVec

	server *http.Server
}

// NewPrometheusMetrics creates a new Prometheus metrics instance
func NewPrometheusMetrics() *PrometheusMetrics {
	metrics := &PrometheusMetrics{
		// Gap Detection Metrics
		GapsDetected: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "p9_gaps_detected_total",
				Help: "Total number of sequence gaps detected",
			},
			[]string{"exchange", "symbol", "severity"},
		),

		GapSizes: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "p9_gap_sizes",
				Help:    "Distribution of gap sizes detected",
				Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
			},
			[]string{"exchange", "symbol"},
		),

		SnapshotRequests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "p9_snapshot_requests_total",
				Help: "Total number of snapshot requests made",
			},
			[]string{"exchange", "symbol", "priority"},
		),

		// Pipeline Metrics
		MessagesProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "p9_messages_processed_total",
				Help: "Total number of messages processed",
			},
			[]string{"exchange", "symbol", "message_type"},
		),

		ProcessingLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "p9_processing_latency_seconds",
				Help:    "Message processing latency in seconds",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
			},
			[]string{"service", "operation"},
		),

		ActiveConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "p9_active_connections",
				Help: "Number of active WebSocket connections",
			},
			[]string{"exchange"},
		),

		// Exchange Metrics
		ExchangeStatus: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "p9_exchange_status",
				Help: "Exchange connection status (1=connected, 0=disconnected)",
			},
			[]string{"exchange"},
		),

		WebSocketReconnects: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "p9_websocket_reconnects_total",
				Help: "Total number of WebSocket reconnections",
			},
			[]string{"exchange", "reason"},
		),

		// Service Health
		ServiceUptime: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "p9_service_uptime_seconds",
				Help: "Service uptime in seconds",
			},
			[]string{"service"},
		),

		RedisOperations: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "p9_redis_operations_total",
				Help: "Total number of Redis operations",
			},
			[]string{"operation", "status"},
		),
	}

	// Register all metrics
	prometheus.MustRegister(
		metrics.GapsDetected,
		metrics.GapSizes,
		metrics.SnapshotRequests,
		metrics.MessagesProcessed,
		metrics.ProcessingLatency,
		metrics.ActiveConnections,
		metrics.ExchangeStatus,
		metrics.WebSocketReconnects,
		metrics.ServiceUptime,
		metrics.RedisOperations,
	)

	return metrics
}

// Start starts the Prometheus metrics HTTP server
func (m *PrometheusMetrics) Start(port string) error {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	m.server = &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	log.Printf("🚀 Starting Prometheus metrics server on port %s", port)
	log.Printf("📊 Metrics endpoint: http://localhost:%s/metrics", port)
	log.Printf("❤️ Health endpoint: http://localhost:%s/health", port)

	go func() {
		if err := m.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("❌ Prometheus server error: %v", err)
		}
	}()

	return nil
}

// Stop stops the Prometheus metrics server
func (m *PrometheusMetrics) Stop() error {
	if m.server == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	log.Println("🛑 Stopping Prometheus metrics server...")
	return m.server.Shutdown(ctx)
}

// RecordGapDetected records a gap detection event
func (m *PrometheusMetrics) RecordGapDetected(exchange, symbol, severity string, gapSize int64) {
	m.GapsDetected.WithLabelValues(exchange, symbol, severity).Inc()
	m.GapSizes.WithLabelValues(exchange, symbol).Observe(float64(gapSize))
}

// RecordSnapshotRequest records a snapshot request
func (m *PrometheusMetrics) RecordSnapshotRequest(exchange, symbol, priority string) {
	m.SnapshotRequests.WithLabelValues(exchange, symbol, priority).Inc()
}

// RecordMessageProcessed records a processed message
func (m *PrometheusMetrics) RecordMessageProcessed(exchange, symbol, messageType string) {
	m.MessagesProcessed.WithLabelValues(exchange, symbol, messageType).Inc()
}

// RecordProcessingLatency records processing latency
func (m *PrometheusMetrics) RecordProcessingLatency(service, operation string, duration time.Duration) {
	m.ProcessingLatency.WithLabelValues(service, operation).Observe(duration.Seconds())
}

// SetActiveConnections sets the number of active connections
func (m *PrometheusMetrics) SetActiveConnections(exchange string, count int) {
	m.ActiveConnections.WithLabelValues(exchange).Set(float64(count))
}

// SetExchangeStatus sets the exchange connection status
func (m *PrometheusMetrics) SetExchangeStatus(exchange string, connected bool) {
	status := 0.0
	if connected {
		status = 1.0
	}
	m.ExchangeStatus.WithLabelValues(exchange).Set(status)
}

// RecordWebSocketReconnect records a WebSocket reconnection
func (m *PrometheusMetrics) RecordWebSocketReconnect(exchange, reason string) {
	m.WebSocketReconnects.WithLabelValues(exchange, reason).Inc()
}

// SetServiceUptime sets the service uptime
func (m *PrometheusMetrics) SetServiceUptime(service string, uptime time.Duration) {
	m.ServiceUptime.WithLabelValues(service).Set(uptime.Seconds())
}

// RecordRedisOperation records a Redis operation
func (m *PrometheusMetrics) RecordRedisOperation(operation, status string) {
	m.RedisOperations.WithLabelValues(operation, status).Inc()
}
