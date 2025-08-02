package config

import (
	"time"
)

// Config represents the complete application configuration
type Config struct {
	Redis         RedisConfig             `yaml:"redis"`
	Exchanges     []ExchangeConfig        `yaml:"exchanges"`
	Symbols       map[string]SymbolConfig `yaml:"symbols"`
	Analytics     AnalyticsConfig         `yaml:"analytics"`
	Detectors     DetectorsConfig         `yaml:"detectors"`
	Advanced      AdvancedConfig          `yaml:"advanced_analytics"`
	Monitoring    MonitoringConfig        `yaml:"monitoring"`
	Performance   PerformanceConfig       `yaml:"performance"`
	Workers       WorkersConfig           `yaml:"workers"`
	Security      SecurityConfig          `yaml:"security"`
	DeepOrderBook DeepOrderBookConfig     `yaml:"deep_orderbook"`
}

// ============================================================================
// CORE CONFIGURATION
// ============================================================================

// RedisConfig represents Redis connection configuration
type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
	Timeout  string `yaml:"timeout"`
}

// ExchangeConfig represents exchange-specific configuration
type ExchangeConfig struct {
	Name                 string        `yaml:"name"`
	Enabled              bool          `yaml:"enabled"`
	WebSocketURL         string        `yaml:"websocket_url"`
	Symbols              []string      `yaml:"symbols"`
	Services             ServiceConfig `yaml:"services"`
	HeartbeatInterval    string        `yaml:"heartbeat_interval"`
	ReconnectBackoff     string        `yaml:"reconnect_backoff"`
	MaxReconnectAttempts int           `yaml:"max_reconnect_attempts"`
}

// ServiceConfig represents which services are enabled for an exchange
type ServiceConfig struct {
	// Core Data Services
	OrderBook   bool `yaml:"orderbook"`
	Trade       bool `yaml:"trade"`
	Liquidation bool `yaml:"liquidation"`

	// Analytics Services
	CVD           bool `yaml:"cvd"`
	WhaleTracker  bool `yaml:"whale_tracker"`
	BookImbalance bool `yaml:"book_imbalance"`

	// Detection Services
	Spoofing      bool `yaml:"spoofing"`
	Momentum      bool `yaml:"momentum"`
	Iceberg       bool `yaml:"iceberg"`
	MeanReversion bool `yaml:"mean_reversion"`
	Volatility    bool `yaml:"volatility"`

	// Advanced Analytics
	VelocityAnalyzer        bool `yaml:"velocity_analyzer"`
	LiquidityVacuumAnalyzer bool `yaml:"liquidity_vacuum_analyzer"`
	VPINAnalyzer            bool `yaml:"vpin_analyzer"`
	DeltaTapeAnalyzer       bool `yaml:"delta_tape_analyzer"`

	// Auxiliary Services
	OrderBookHeatmap      bool `yaml:"orderbook_heatmap"`
	LiquidationMonitor    bool `yaml:"liquidation_monitor"`
	HTFBiasAnalyzer       bool `yaml:"htf_bias_analyzer"`
	MicrostructureAnomaly bool `yaml:"microstructure_anomaly"`
}

// SymbolConfig represents symbol-specific configuration
type SymbolConfig struct {
	Enabled                bool     `yaml:"enabled"`
	WhaleThreshold         float64  `yaml:"whale_threshold"`
	BookLevels             int      `yaml:"book_levels"`
	CVDWindow              string   `yaml:"cvd_window"`
	VolatilityWindows      []string `yaml:"volatility_windows"`
	WallDetectionThreshold float64  `yaml:"wall_detection_threshold"`
}

// ============================================================================
// ANALYTICS CONFIGURATION
// ============================================================================

// AnalyticsConfig represents analytics service configuration
type AnalyticsConfig struct {
	CVDCalculator         CVDConfig                   `yaml:"cvd_calculator"`
	WhaleTracker          WhaleConfig                 `yaml:"whale_tracker"`
	MomentumDetector      MomentumConfig              `yaml:"momentum_detector"`
	VolatilityMonitor     VolatilityConfig            `yaml:"volatility_monitor"`
	SpoofingDetector      SpoofingConfig              `yaml:"spoofing_detector"`
	FundingRateAggregator FundingRateAggregatorConfig `yaml:"funding_rate_aggregator"`
	MarkPricePoller       MarkPricePollerConfig       `yaml:"mark_price_poller"`
	OpenInterestPoller    OpenInterestPollerConfig    `yaml:"open_interest_poller"`
	DepthGapWatcher       DepthGapWatcherConfig       `yaml:"depth_gap_watcher"`
	BookTickerAggregator  BookTickerAggregatorConfig  `yaml:"book_ticker_aggregator"`
	PeriodicSnapshots     PeriodicSnapshotsConfig     `yaml:"periodic_snapshots"`
	InsuranceFundMonitor  InsuranceFundMonitorConfig  `yaml:"insurance_fund_monitor"`
	RedisPublishConfirmer RedisPublishConfirmerConfig `yaml:"redis_publish_confirmer"`
	BookImbalanceDetector BookImbalanceConfig         `yaml:"book_imbalance_detector"`
}

// FundingRateAggregatorConfig represents funding-rate aggregator settings
type FundingRateAggregatorConfig struct {
	Enabled      bool   `yaml:"enabled"`
	PollInterval string `yaml:"poll_interval"` // e.g. "30s"
}

// MarkPricePollerConfig represents mark-price poller settings
type MarkPricePollerConfig struct {
	Enabled      bool   `yaml:"enabled"`
	PollInterval string `yaml:"poll_interval"` // e.g. "10s"
}

// OpenInterestPollerConfig represents open-interest poller settings
type OpenInterestPollerConfig struct {
	Enabled      bool   `yaml:"enabled"`
	PollInterval string `yaml:"poll_interval"` // e.g. "15s"
}

type DepthGapWatcherConfig struct {
	Enabled    bool   `yaml:"enabled"`
	MaxGapSize int64  `yaml:"max_gap_size"`
	GapTimeout string `yaml:"gap_timeout"`
}

// BookTickerAggregatorConfig represents book ticker aggregator settings
type BookTickerAggregatorConfig struct {
	Enabled        bool   `yaml:"enabled"`
	PublishChannel string `yaml:"publish_channel"`
}

// PeriodicSnapshotsConfig represents periodic snapshot generator settings
type PeriodicSnapshotsConfig struct {
	Enabled         bool   `yaml:"enabled"`
	Interval        string `yaml:"interval"`
	StorageDuration string `yaml:"storage_duration"`
}

// InsuranceFundMonitorConfig represents insurance fund monitor settings
type InsuranceFundMonitorConfig struct {
	Enabled      bool     `yaml:"enabled"`
	PollInterval string   `yaml:"poll_interval"`
	Exchanges    []string `yaml:"exchanges"`
}

// RedisPublishConfirmerConfig represents Redis publish confirmer settings
type RedisPublishConfirmerConfig struct {
	Enabled        bool   `yaml:"enabled"`
	MaxRetries     int    `yaml:"max_retries"`
	RetryDelay     string `yaml:"retry_delay"`
	ConfirmTimeout string `yaml:"confirm_timeout"`
}

// CVDConfig represents CVD calculator configuration
type CVDConfig struct {
	Enabled    bool     `yaml:"enabled"`
	Timeframes []string `yaml:"timeframes"`
}

// WhaleConfig represents whale tracker configuration
type WhaleConfig struct {
	Enabled    bool               `yaml:"enabled"`
	Thresholds map[string]float64 `yaml:"thresholds"`
}

// MomentumConfig represents momentum detector configuration
type MomentumConfig struct {
	Enabled              bool    `yaml:"enabled"`
	PriceChangeThreshold float64 `yaml:"price_change_threshold"`
	VolumeThreshold      float64 `yaml:"volume_threshold"`
	TimeWindow           int     `yaml:"time_window"`
}

// VolatilityConfig represents volatility monitor configuration
type VolatilityConfig struct {
	Enabled        bool     `yaml:"enabled"`
	Timeframes     []string `yaml:"timeframes"`
	SpikeThreshold float64  `yaml:"spike_threshold"`
}

// SpoofingConfig represents spoofing detector configuration
type SpoofingConfig struct {
	Enabled                   bool    `yaml:"enabled"`
	MinOrderSize              float64 `yaml:"min_order_size"`
	CancellationThreshold     float64 `yaml:"cancellation_threshold"`
	PhantomLiquidityThreshold float64 `yaml:"phantom_liquidity_threshold"`
}

// ============================================================================
// DETECTION ENGINES CONFIGURATION
// ============================================================================

// DetectorsConfig represents detection engines configuration
type DetectorsConfig struct {
	BookImbalance      BookImbalanceConfig      `yaml:"book_imbalance"`
	OrderBookHeatmap   HeatmapConfig            `yaml:"orderbook_heatmap"`
	LiquidationMonitor LiquidationMonitorConfig `yaml:"liquidation_monitor"`
	MeanReversion      MeanReversionConfig      `yaml:"mean_reversion"`
	IcebergDetector    IcebergConfig            `yaml:"iceberg_detector"`
}

// BookImbalanceConfig represents book imbalance detector configuration
type BookImbalanceConfig struct {
	Enabled            bool    `yaml:"enabled"`
	ImbalanceThreshold float64 `yaml:"imbalance_threshold"`
}

// HeatmapConfig represents order book heatmap configuration
type HeatmapConfig struct {
	Enabled     bool `yaml:"enabled"`
	DepthLevels int  `yaml:"depth_levels"`
}

// LiquidationMonitorConfig represents liquidation monitor configuration
type LiquidationMonitorConfig struct {
	Enabled          bool    `yaml:"enabled"`
	ClusterThreshold float64 `yaml:"cluster_threshold"`
}

// MeanReversionConfig represents mean reversion detector configuration
type MeanReversionConfig struct {
	Enabled         bool    `yaml:"enabled"`
	ZScoreThreshold float64 `yaml:"z_score_threshold"`
}

// IcebergConfig represents iceberg detector configuration
type IcebergConfig struct {
	Enabled           bool    `yaml:"enabled"`
	FragmentThreshold float64 `yaml:"fragment_threshold"`
}

// ============================================================================
// ADVANCED ANALYTICS CONFIGURATION
// ============================================================================

// AdvancedConfig represents advanced analytics configuration
type AdvancedConfig struct {
	VelocityAnalyzer        VelocityConfig  `yaml:"velocity_analyzer"`
	LiquidityVacuumAnalyzer VacuumConfig    `yaml:"liquidity_vacuum_analyzer"`
	VPINAnalyzer            VPINConfig      `yaml:"vpin_analyzer"`
	DeltaTapeAnalyzer       DeltaTapeConfig `yaml:"delta_tape_analyzer"`
	RegimeClassifier        RegimeConfig    `yaml:"regime_classifier"`
}

// VelocityConfig represents velocity analyzer configuration
type VelocityConfig struct {
	Enabled           bool     `yaml:"enabled"`
	Timeframes        []string `yaml:"timeframes"`
	VelocityThreshold float64  `yaml:"velocity_threshold"`
}

// VacuumConfig represents liquidity vacuum analyzer configuration
type VacuumConfig struct {
	Enabled         bool    `yaml:"enabled"`
	VacuumThreshold float64 `yaml:"vacuum_threshold"`
}

// VPINConfig represents VPIN analyzer configuration
type VPINConfig struct {
	Enabled           bool    `yaml:"enabled"`
	BucketSize        int     `yaml:"bucket_size"`
	NumBuckets        int     `yaml:"num_buckets"`
	ToxicityThreshold float64 `yaml:"toxicity_threshold"`
}

// DeltaTapeConfig represents delta tape analyzer configuration
type DeltaTapeConfig struct {
	Enabled       bool    `yaml:"enabled"`
	FlowThreshold float64 `yaml:"flow_threshold"`
}

// RegimeConfig represents regime classifier configuration
type RegimeConfig struct {
	Enabled             bool    `yaml:"enabled"`
	VolatilityThreshold float64 `yaml:"volatility_threshold"`
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

// MonitoringConfig represents monitoring configuration
type MonitoringConfig struct {
	HealthCheckInterval int  `yaml:"health_check_interval"`
	MetricsEnabled      bool `yaml:"metrics_enabled"`
	PrometheusPort      int  `yaml:"prometheus_port"`
}

// PerformanceConfig represents performance configuration
type PerformanceConfig struct {
	BufferSize    int    `yaml:"buffer_size"`
	BatchSize     int    `yaml:"batch_size"`
	FlushInterval string `yaml:"flush_interval"`
	MaxMemoryMB   int    `yaml:"max_memory_mb"`
}

// WorkersConfig represents worker configuration
type WorkersConfig struct {
	WebSocketWorkers int `yaml:"websocket_workers"`
	AnalyticsWorkers int `yaml:"analytics_workers"`
	DetectionWorkers int `yaml:"detection_workers"`
	AuxiliaryWorkers int `yaml:"auxiliary_workers"`
	TotalWorkers     int `yaml:"total_workers"`
}

// SecurityConfig represents security configuration
type SecurityConfig struct {
	RateLimiting RateLimitConfig `yaml:"rate_limiting"`
	CORS         CORSConfig      `yaml:"cors"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	Enabled           bool `yaml:"enabled"`
	RequestsPerSecond int  `yaml:"requests_per_second"`
	Burst             int  `yaml:"burst"`
}

// CORSConfig represents CORS configuration
type CORSConfig struct {
	Enabled        bool     `yaml:"enabled"`
	AllowedOrigins []string `yaml:"allowed_origins"`
	AllowedMethods []string `yaml:"allowed_methods"`
}

// DeepOrderBookConfig represents deep order book configuration
type DeepOrderBookConfig struct {
	Enabled            bool                   `yaml:"enabled"`
	MaxLevels          int                    `yaml:"max_levels"`
	UpdateFrequency    string                 `yaml:"update_frequency"`
	MemoryOptimization bool                   `yaml:"memory_optimization"`
	Compression        bool                   `yaml:"compression"`
	Analytics          DeepOrderBookAnalytics `yaml:"analytics"`
}

// DeepOrderBookAnalytics represents deep order book analytics configuration
type DeepOrderBookAnalytics struct {
	LiquidityProfiling      bool `yaml:"liquidity_profiling"`
	IcebergDetection        bool `yaml:"iceberg_detection"`
	SpoofingAnalysis        bool `yaml:"spoofing_analysis"`
	MarketImpactCalculation bool `yaml:"market_impact_calculation"`
}

// ============================================================================
// HELPER METHODS
// ============================================================================

// GetTimeframeDuration converts timeframe string to time.Duration
func (c *Config) GetTimeframeDuration(timeframe string) time.Duration {
	switch timeframe {
	case "10s":
		return 10 * time.Second
	case "30s":
		return 30 * time.Second
	case "1m":
		return time.Minute
	case "2m":
		return 2 * time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "1h":
		return time.Hour
	case "4h":
		return 4 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return time.Minute
	}
}

// GetSymbolConfig returns configuration for a specific symbol
func (c *Config) GetSymbolConfig(symbol string) (SymbolConfig, bool) {
	config, exists := c.Symbols[symbol]
	return config, exists
}

// GetExchangeConfig returns configuration for a specific exchange
func (c *Config) GetExchangeConfig(exchangeName string) (ExchangeConfig, bool) {
	for _, exchange := range c.Exchanges {
		if exchange.Name == exchangeName {
			return exchange, true
		}
	}
	return ExchangeConfig{}, false
}

// IsServiceEnabled checks if a service is enabled for an exchange
func (sc *ServiceConfig) IsServiceEnabled(serviceName string) bool {
	switch serviceName {
	case "orderbook":
		return sc.OrderBook
	case "trade":
		return sc.Trade
	case "liquidation":
		return sc.Liquidation
	case "cvd":
		return sc.CVD
	case "whale_tracker":
		return sc.WhaleTracker
	case "book_imbalance":
		return sc.BookImbalance
	case "spoofing":
		return sc.Spoofing
	case "momentum":
		return sc.Momentum
	case "iceberg":
		return sc.Iceberg
	case "mean_reversion":
		return sc.MeanReversion
	case "volatility":
		return sc.Volatility
	case "velocity_analyzer":
		return sc.VelocityAnalyzer
	case "liquidity_vacuum_analyzer":
		return sc.LiquidityVacuumAnalyzer
	case "vpin_analyzer":
		return sc.VPINAnalyzer
	case "delta_tape_analyzer":
		return sc.DeltaTapeAnalyzer
	case "orderbook_heatmap":
		return sc.OrderBookHeatmap
	case "liquidation_monitor":
		return sc.LiquidationMonitor
	case "htf_bias_analyzer":
		return sc.HTFBiasAnalyzer
	case "microstructure_anomaly":
		return sc.MicrostructureAnomaly
	default:
		return false
	}
}

// GetEnabledServices returns a list of enabled services for the exchange
func (sc *ServiceConfig) GetEnabledServices() []string {
	var enabled []string

	if sc.OrderBook {
		enabled = append(enabled, "orderbook")
	}
	if sc.Trade {
		enabled = append(enabled, "trade")
	}
	if sc.Liquidation {
		enabled = append(enabled, "liquidation")
	}
	if sc.CVD {
		enabled = append(enabled, "cvd")
	}
	if sc.WhaleTracker {
		enabled = append(enabled, "whale_tracker")
	}
	if sc.BookImbalance {
		enabled = append(enabled, "book_imbalance")
	}
	if sc.Spoofing {
		enabled = append(enabled, "spoofing")
	}
	if sc.Momentum {
		enabled = append(enabled, "momentum")
	}
	if sc.Iceberg {
		enabled = append(enabled, "iceberg")
	}
	if sc.MeanReversion {
		enabled = append(enabled, "mean_reversion")
	}
	if sc.Volatility {
		enabled = append(enabled, "volatility")
	}
	if sc.VelocityAnalyzer {
		enabled = append(enabled, "velocity_analyzer")
	}
	if sc.LiquidityVacuumAnalyzer {
		enabled = append(enabled, "liquidity_vacuum_analyzer")
	}
	if sc.VPINAnalyzer {
		enabled = append(enabled, "vpin_analyzer")
	}
	if sc.DeltaTapeAnalyzer {
		enabled = append(enabled, "delta_tape_analyzer")
	}
	if sc.OrderBookHeatmap {
		enabled = append(enabled, "orderbook_heatmap")
	}
	if sc.LiquidationMonitor {
		enabled = append(enabled, "liquidation_monitor")
	}
	if sc.HTFBiasAnalyzer {
		enabled = append(enabled, "htf_bias_analyzer")
	}
	if sc.MicrostructureAnomaly {
		enabled = append(enabled, "microstructure_anomaly")
	}

	return enabled
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// Add validation logic here
	// Check required fields, validate ranges, etc.
	return nil
}
