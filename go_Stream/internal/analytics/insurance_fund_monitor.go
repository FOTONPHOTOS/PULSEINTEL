package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"pulseintel/internal/config"
)

// ============================================================================
// INSURANCE FUND MONITOR - ITEM 12: INSURANCE FUND BALANCE
// ============================================================================

// InsuranceFund represents insurance fund data
type InsuranceFund struct {
	Exchange      string    `json:"exchange"`
	Asset         string    `json:"asset"`          // Base asset (BTC, ETH, etc.)
	Balance       float64   `json:"balance"`        // Current balance
	BalanceUSD    float64   `json:"balance_usd"`    // USD equivalent
	Change24h     float64   `json:"change_24h"`     // 24h change
	ChangePercent float64   `json:"change_percent"` // 24h change percentage
	LastUpdate    time.Time `json:"last_update"`    // Last update from exchange
	Timestamp     time.Time `json:"timestamp"`      // Our timestamp
	StressLevel   string    `json:"stress_level"`   // "LOW", "MEDIUM", "HIGH", "CRITICAL"
}

// InsuranceFundResponse represents API response structure
type InsuranceFundResponse struct {
	Exchange string                   `json:"exchange"`
	Data     []map[string]interface{} `json:"data"`
}

// InsuranceFundMonitor monitors insurance fund balances across exchanges
type InsuranceFundMonitor struct {
	redisClient *redis.Client
	cfg         *config.Config
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup

	// Configuration
	pollInterval time.Duration
	exchanges    []string
	httpClient   *http.Client

	// State tracking
	funds        map[string]*InsuranceFund // [exchange:asset] -> InsuranceFund
	lastBalances map[string]float64        // [exchange:asset] -> previous balance
	mutex        sync.RWMutex

	// Statistics
	fundsTracked    int64
	lastStatsReport time.Time
}

// NewInsuranceFundMonitor creates a new insurance fund monitor
func NewInsuranceFundMonitor(redisClient *redis.Client, cfg *config.Config) *InsuranceFundMonitor {
	ctx, cancel := context.WithCancel(context.Background())

	// Default configuration
	pollInterval := 5 * time.Minute           // Poll every 5 minutes
	exchanges := []string{"binance", "bybit"} // OKX doesn't expose insurance fund

	return &InsuranceFundMonitor{
		redisClient:     redisClient,
		cfg:             cfg,
		ctx:             ctx,
		cancel:          cancel,
		pollInterval:    pollInterval,
		exchanges:       exchanges,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		funds:           make(map[string]*InsuranceFund),
		lastBalances:    make(map[string]float64),
		lastStatsReport: time.Now(),
	}
}

// Start starts the insurance fund monitor
func (ifm *InsuranceFundMonitor) Start() {
	log.Printf("🏦 Starting Insurance Fund Monitor (interval: %v)...", ifm.pollInterval)

	// Start polling loop
	ifm.wg.Add(1)
	go func() {
		defer ifm.wg.Done()
		ifm.pollingLoop()
	}()

	// Start statistics reporting
	ifm.wg.Add(1)
	go func() {
		defer ifm.wg.Done()
		ifm.statsReportingLoop()
	}()

	log.Println("✅ Insurance Fund Monitor started")
}

// pollingLoop polls insurance fund data at regular intervals
func (ifm *InsuranceFundMonitor) pollingLoop() {
	// Initial fetch
	ifm.fetchAllInsuranceFunds()

	ticker := time.NewTicker(ifm.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ifm.ctx.Done():
			return
		case <-ticker.C:
			ifm.fetchAllInsuranceFunds()
		}
	}
}

// fetchAllInsuranceFunds fetches insurance fund data from all exchanges
func (ifm *InsuranceFundMonitor) fetchAllInsuranceFunds() {
	for _, exchange := range ifm.exchanges {
		go ifm.fetchInsuranceFund(exchange)
	}
}

// fetchInsuranceFund fetches insurance fund data from a specific exchange
func (ifm *InsuranceFundMonitor) fetchInsuranceFund(exchange string) {
	// Create mock insurance fund data for demonstration
	fund := &InsuranceFund{
		Exchange:    exchange,
		Asset:       "BTC",
		Balance:     10000.0,         // Mock balance
		BalanceUSD:  10000.0 * 50000, // Mock USD value
		LastUpdate:  time.Now(),
		Timestamp:   time.Now(),
		StressLevel: "LOW",
	}

	ifm.processFund(fund)
}

// processFund processes and stores insurance fund data
func (ifm *InsuranceFundMonitor) processFund(fund *InsuranceFund) {
	key := fmt.Sprintf("%s:%s", fund.Exchange, fund.Asset)

	// Calculate 24h change if we have previous data
	ifm.mutex.Lock()
	if lastBalance, exists := ifm.lastBalances[key]; exists {
		fund.Change24h = fund.Balance - lastBalance
		if lastBalance > 0 {
			fund.ChangePercent = (fund.Change24h / lastBalance) * 100
		}
	}

	// Store current balance for next comparison
	ifm.lastBalances[key] = fund.Balance
	ifm.funds[key] = fund
	ifm.fundsTracked++
	ifm.mutex.Unlock()

	// Publish to Redis
	ifm.publishInsuranceFund(fund)

	log.Printf("🏦 Insurance Fund: %s %s - Balance: %.2f %s, Stress: %s",
		fund.Exchange, fund.Asset, fund.Balance, fund.Asset, fund.StressLevel)
}

// publishInsuranceFund publishes insurance fund data to Redis
func (ifm *InsuranceFundMonitor) publishInsuranceFund(fund *InsuranceFund) {
	channel := fmt.Sprintf("insurance_fund:%s:%s", fund.Exchange, fund.Asset)

	data, err := json.Marshal(fund)
	if err != nil {
		log.Printf("ERROR: Failed to marshal insurance fund: %v", err)
		return
	}

	err = ifm.redisClient.Publish(ifm.ctx, channel, string(data)).Err()
	if err != nil {
		log.Printf("ERROR: Failed to publish insurance fund: %v", err)
		return
	}
}

// statsReportingLoop reports statistics periodically
func (ifm *InsuranceFundMonitor) statsReportingLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ifm.ctx.Done():
			return
		case <-ticker.C:
			ifm.reportStats()
		}
	}
}

// reportStats reports monitor statistics
func (ifm *InsuranceFundMonitor) reportStats() {
	ifm.mutex.RLock()
	tracked := ifm.fundsTracked
	active := len(ifm.funds)
	ifm.mutex.RUnlock()

	log.Printf("🏦 Insurance Fund Stats: %d tracked, %d active funds",
		tracked, active)
}

// Stop stops the insurance fund monitor
func (ifm *InsuranceFundMonitor) Stop() {
	ifm.cancel()
	ifm.wg.Wait()
	log.Println("🏦 Insurance Fund Monitor stopped")
}

// GetStats returns monitor statistics
func (ifm *InsuranceFundMonitor) GetStats() map[string]interface{} {
	ifm.mutex.RLock()
	defer ifm.mutex.RUnlock()

	return map[string]interface{}{
		"funds_tracked": ifm.fundsTracked,
		"active_funds":  len(ifm.funds),
		"poll_interval": ifm.pollInterval.String(),
		"exchanges":     ifm.exchanges,
	}
}

// Helper functions - reserved for future API integration
func parseStringField(data map[string]interface{}, key string) string {
	if val, exists := data[key]; exists {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func parseFloatField(data map[string]interface{}, key string) float64 {
	if val, exists := data[key]; exists {
		switch v := val.(type) {
		case float64:
			return v
		case string:
			if f, err := json.Number(v).Float64(); err == nil {
				return f
			}
		}
	}
	return 0.0
}

// Mark functions as used to avoid compiler warnings
var _ = parseStringField
var _ = parseFloatField
