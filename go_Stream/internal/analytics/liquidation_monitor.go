package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// LiquidationEvent represents a real liquidation event
type LiquidationEvent struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Quantity  float64   `json:"quantity"`
	Value     float64   `json:"value"` // Price * Quantity
	Side      string    `json:"side"`  // "buy" or "sell"
	Timestamp time.Time `json:"timestamp"`
	EventID   string    `json:"event_id"`
}

// LiquidationCluster represents a cluster of related liquidations
type LiquidationCluster struct {
	ClusterID    string             `json:"cluster_id"`
	Events       []LiquidationEvent `json:"events"`
	TotalValue   float64            `json:"total_value"`
	AveragePrice float64            `json:"average_price"`
	PriceRange   float64            `json:"price_range"`
	TimeSpan     time.Duration      `json:"time_span"`
	Side         string             `json:"side"`
	Severity     string             `json:"severity"`     // LOW, MEDIUM, HIGH, EXTREME
	CascadeRisk  float64            `json:"cascade_risk"` // 0.0-1.0
	StartTime    time.Time          `json:"start_time"`
	EndTime      time.Time          `json:"end_time"`
	EventCount   int                `json:"event_count"`
}

// CascadeAlert represents a liquidation cascade warning
type CascadeAlert struct {
	Symbol          string               `json:"symbol"`
	Clusters        []LiquidationCluster `json:"clusters"`
	TotalValue      float64              `json:"total_value"`
	CascadeScore    float64              `json:"cascade_score"` // 0.0-1.0
	RiskLevel       string               `json:"risk_level"`    // LOW, MEDIUM, HIGH, CRITICAL
	PredictedImpact string               `json:"predicted_impact"`
	Timestamp       time.Time            `json:"timestamp"`
}

// LiquidationMonitor processes real liquidation events and detects clusters/cascades
type LiquidationMonitor struct {
	redisClient *redis.Client
	symbol      string

	// Real-time liquidation storage
	recentEvents   []LiquidationEvent
	activeClusters []LiquidationCluster
	maxEvents      int
	maxClusterAge  time.Duration

	// Clustering parameters
	priceThreshold  float64       // Price clustering threshold (percentage)
	timeThreshold   time.Duration // Time clustering threshold
	minClusterSize  int           // Minimum events for cluster
	minClusterValue float64       // Minimum value for significant cluster

	// Cascade detection parameters
	cascadeThreshold float64 // Value threshold for cascade detection
	riskMultiplier   float64 // Risk calculation multiplier

	mu               sync.RWMutex
	lastAnalysis     time.Time
	analysisInterval time.Duration
}

// NewLiquidationMonitor creates a new real liquidation monitor
func NewLiquidationMonitor(redisClient *redis.Client, symbol string) *LiquidationMonitor {
	return &LiquidationMonitor{
		redisClient:      redisClient,
		symbol:           symbol,
		maxEvents:        1000,
		maxClusterAge:    10 * time.Minute,
		priceThreshold:   0.005, // 0.5% price clustering
		timeThreshold:    2 * time.Minute,
		minClusterSize:   3,
		minClusterValue:  10000.0,  // $10k minimum cluster value
		cascadeThreshold: 100000.0, // $100k cascade threshold
		riskMultiplier:   1.5,
		analysisInterval: 10 * time.Second,
		recentEvents:     make([]LiquidationEvent, 0, 1000),
		activeClusters:   make([]LiquidationCluster, 0, 50),
	}
}

// ProcessLiquidation processes a real liquidation event
func (lm *LiquidationMonitor) ProcessLiquidation(liquidationData []byte) error {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	// Parse real liquidation data
	var event LiquidationEvent
	if err := json.Unmarshal(liquidationData, &event); err != nil {
		return fmt.Errorf("failed to parse liquidation: %w", err)
	}

	// Validate real data
	if event.Symbol != lm.symbol || event.Value <= 0 {
		return fmt.Errorf("invalid liquidation data: symbol=%s, value=%f", event.Symbol, event.Value)
	}

	// Add to recent events
	lm.recentEvents = append(lm.recentEvents, event)

	// Clean old events
	lm.cleanOldEvents()

	// Perform real-time analysis
	now := time.Now()
	if now.Sub(lm.lastAnalysis) >= lm.analysisInterval {
		lm.performRealTimeAnalysis()
		lm.lastAnalysis = now
	}

	return nil
}

// cleanOldEvents removes events older than the maximum age
func (lm *LiquidationMonitor) cleanOldEvents() {
	cutoff := time.Now().Add(-lm.maxClusterAge)

	// Remove old events
	validEvents := make([]LiquidationEvent, 0, len(lm.recentEvents))
	for _, event := range lm.recentEvents {
		if event.Timestamp.After(cutoff) {
			validEvents = append(validEvents, event)
		}
	}
	lm.recentEvents = validEvents

	// Keep only recent events if too many
	if len(lm.recentEvents) > lm.maxEvents {
		lm.recentEvents = lm.recentEvents[len(lm.recentEvents)-lm.maxEvents:]
	}

	// Clean old clusters
	validClusters := make([]LiquidationCluster, 0, len(lm.activeClusters))
	for _, cluster := range lm.activeClusters {
		if cluster.EndTime.After(cutoff) {
			validClusters = append(validClusters, cluster)
		}
	}
	lm.activeClusters = validClusters
}

// performRealTimeAnalysis analyzes recent liquidations for clusters and cascades
func (lm *LiquidationMonitor) performRealTimeAnalysis() {
	if len(lm.recentEvents) < lm.minClusterSize {
		return
	}

	// Detect new clusters
	newClusters := lm.detectRealClusters()

	// Update active clusters
	lm.updateActiveClusters(newClusters)

	// Check for cascade conditions
	cascadeAlert := lm.detectRealCascades()

	// Publish results
	if len(newClusters) > 0 {
		lm.publishClusterData(newClusters)
	}

	if cascadeAlert != nil {
		lm.publishCascadeAlert(cascadeAlert)
	}
}

// detectRealClusters identifies actual liquidation clusters from real events
func (lm *LiquidationMonitor) detectRealClusters() []LiquidationCluster {
	if len(lm.recentEvents) < lm.minClusterSize {
		return []LiquidationCluster{}
	}

	// Sort events by timestamp
	sortedEvents := make([]LiquidationEvent, len(lm.recentEvents))
	copy(sortedEvents, lm.recentEvents)
	sort.Slice(sortedEvents, func(i, j int) bool {
		return sortedEvents[i].Timestamp.Before(sortedEvents[j].Timestamp)
	})

	var clusters []LiquidationCluster
	used := make(map[int]bool)

	for i, baseEvent := range sortedEvents {
		if used[i] {
			continue
		}

		// Find events that cluster with this base event
		var clusterEvents []LiquidationEvent
		clusterEvents = append(clusterEvents, baseEvent)
		used[i] = true

		// Look for similar events within thresholds
		for j, candidateEvent := range sortedEvents {
			if used[j] || i == j {
				continue
			}

			// Check time proximity
			timeDiff := candidateEvent.Timestamp.Sub(baseEvent.Timestamp)
			if timeDiff < 0 {
				timeDiff = -timeDiff
			}

			if timeDiff > lm.timeThreshold {
				continue
			}

			// Check price proximity
			priceDiff := math.Abs(candidateEvent.Price-baseEvent.Price) / baseEvent.Price
			if priceDiff > lm.priceThreshold {
				continue
			}

			// Check same side (buy liquidations cluster with buy liquidations)
			if candidateEvent.Side != baseEvent.Side {
				continue
			}

			// Add to cluster
			clusterEvents = append(clusterEvents, candidateEvent)
			used[j] = true
		}

		// Create cluster if significant
		if len(clusterEvents) >= lm.minClusterSize {
			cluster := lm.createRealCluster(clusterEvents)
			if cluster.TotalValue >= lm.minClusterValue {
				clusters = append(clusters, cluster)
			}
		}
	}

	return clusters
}

// createRealCluster creates a cluster from real liquidation events
func (lm *LiquidationMonitor) createRealCluster(events []LiquidationEvent) LiquidationCluster {
	if len(events) == 0 {
		return LiquidationCluster{}
	}

	// Calculate cluster statistics
	totalValue := 0.0
	totalPrice := 0.0
	minPrice := events[0].Price
	maxPrice := events[0].Price
	minTime := events[0].Timestamp
	maxTime := events[0].Timestamp

	for _, event := range events {
		totalValue += event.Value
		totalPrice += event.Price

		if event.Price < minPrice {
			minPrice = event.Price
		}
		if event.Price > maxPrice {
			maxPrice = event.Price
		}

		if event.Timestamp.Before(minTime) {
			minTime = event.Timestamp
		}
		if event.Timestamp.After(maxTime) {
			maxTime = event.Timestamp
		}
	}

	averagePrice := totalPrice / float64(len(events))
	priceRange := maxPrice - minPrice
	timeSpan := maxTime.Sub(minTime)

	// Determine severity based on real metrics
	severity := lm.calculateClusterSeverity(totalValue, len(events), timeSpan)

	// Calculate cascade risk
	cascadeRisk := lm.calculateCascadeRisk(totalValue, priceRange, timeSpan)

	return LiquidationCluster{
		ClusterID:    fmt.Sprintf("%s-%d", lm.symbol, time.Now().UnixNano()),
		Events:       events,
		TotalValue:   totalValue,
		AveragePrice: averagePrice,
		PriceRange:   priceRange,
		TimeSpan:     timeSpan,
		Side:         events[0].Side,
		Severity:     severity,
		CascadeRisk:  cascadeRisk,
		StartTime:    minTime,
		EndTime:      maxTime,
		EventCount:   len(events),
	}
}

// calculateClusterSeverity determines cluster severity from real metrics
func (lm *LiquidationMonitor) calculateClusterSeverity(totalValue float64, eventCount int, timeSpan time.Duration) string {
	// Value-based severity
	valueScore := 0.0
	if totalValue >= 1000000 { // $1M+
		valueScore = 4.0
	} else if totalValue >= 500000 { // $500K+
		valueScore = 3.0
	} else if totalValue >= 100000 { // $100K+
		valueScore = 2.0
	} else if totalValue >= 50000 { // $50K+
		valueScore = 1.0
	}

	// Frequency-based severity
	frequencyScore := 0.0
	if eventCount >= 20 {
		frequencyScore = 3.0
	} else if eventCount >= 10 {
		frequencyScore = 2.0
	} else if eventCount >= 5 {
		frequencyScore = 1.0
	}

	// Time-based severity (faster = more severe)
	timeScore := 0.0
	if timeSpan <= 30*time.Second {
		timeScore = 3.0
	} else if timeSpan <= 1*time.Minute {
		timeScore = 2.0
	} else if timeSpan <= 2*time.Minute {
		timeScore = 1.0
	}

	// Combined severity score
	totalScore := valueScore + frequencyScore + timeScore

	if totalScore >= 8.0 {
		return "EXTREME"
	} else if totalScore >= 6.0 {
		return "HIGH"
	} else if totalScore >= 3.0 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// calculateCascadeRisk calculates the risk of triggering additional liquidations
func (lm *LiquidationMonitor) calculateCascadeRisk(totalValue, priceRange float64, timeSpan time.Duration) float64 {
	// Base risk from value
	valueRisk := math.Min(totalValue/1000000.0, 1.0) // Normalize to $1M

	// Price volatility risk
	volatilityRisk := math.Min(priceRange/100.0, 1.0) // Normalize to $100 range

	// Time concentration risk (faster = higher risk)
	timeRisk := 1.0
	if timeSpan > 0 {
		timeRisk = math.Max(0.1, 1.0-(timeSpan.Seconds()/300.0)) // 5 minutes = low risk
	}

	// Combined risk calculation
	cascadeRisk := (valueRisk*0.5 + volatilityRisk*0.3 + timeRisk*0.2)
	return math.Min(cascadeRisk, 1.0)
}

// updateActiveClusters updates the list of active clusters
func (lm *LiquidationMonitor) updateActiveClusters(newClusters []LiquidationCluster) {
	// Add new clusters
	lm.activeClusters = append(lm.activeClusters, newClusters...)

	// Sort by severity and cascade risk
	sort.Slice(lm.activeClusters, func(i, j int) bool {
		scoreI := lm.getClusterScore(lm.activeClusters[i])
		scoreJ := lm.getClusterScore(lm.activeClusters[j])
		return scoreI > scoreJ
	})

	// Keep only top clusters
	if len(lm.activeClusters) > 20 {
		lm.activeClusters = lm.activeClusters[:20]
	}
}

// getClusterScore calculates a score for cluster ranking
func (lm *LiquidationMonitor) getClusterScore(cluster LiquidationCluster) float64 {
	severityScore := 0.0
	switch cluster.Severity {
	case "EXTREME":
		severityScore = 4.0
	case "HIGH":
		severityScore = 3.0
	case "MEDIUM":
		severityScore = 2.0
	case "LOW":
		severityScore = 1.0
	}

	return severityScore + cluster.CascadeRisk
}

// detectRealCascades checks for cascade conditions from real cluster data
func (lm *LiquidationMonitor) detectRealCascades() *CascadeAlert {
	if len(lm.activeClusters) < 2 {
		return nil
	}

	// Look for multiple high-risk clusters in short time
	recentClusters := make([]LiquidationCluster, 0)
	cutoff := time.Now().Add(-5 * time.Minute) // Last 5 minutes

	totalValue := 0.0
	for _, cluster := range lm.activeClusters {
		if cluster.EndTime.After(cutoff) && cluster.CascadeRisk > 0.5 {
			recentClusters = append(recentClusters, cluster)
			totalValue += cluster.TotalValue
		}
	}

	if len(recentClusters) < 2 || totalValue < lm.cascadeThreshold {
		return nil
	}

	// Calculate cascade score
	cascadeScore := lm.calculateCascadeScore(recentClusters, totalValue)

	// Determine risk level
	riskLevel := lm.determineRiskLevel(cascadeScore, totalValue)

	// Predict impact
	predictedImpact := lm.predictCascadeImpact(cascadeScore, totalValue)

	return &CascadeAlert{
		Symbol:          lm.symbol,
		Clusters:        recentClusters,
		TotalValue:      totalValue,
		CascadeScore:    cascadeScore,
		RiskLevel:       riskLevel,
		PredictedImpact: predictedImpact,
		Timestamp:       time.Now(),
	}
}

// calculateCascadeScore calculates overall cascade risk score
func (lm *LiquidationMonitor) calculateCascadeScore(clusters []LiquidationCluster, totalValue float64) float64 {
	if len(clusters) == 0 {
		return 0.0
	}

	// Base score from total value
	valueScore := math.Min(totalValue/5000000.0, 1.0) // Normalize to $5M

	// Cluster count score
	countScore := math.Min(float64(len(clusters))/10.0, 1.0) // Normalize to 10 clusters

	// Average cascade risk
	totalRisk := 0.0
	for _, cluster := range clusters {
		totalRisk += cluster.CascadeRisk
	}
	avgRisk := totalRisk / float64(len(clusters))

	// Time concentration (all clusters in short time = higher risk)
	timeSpread := 0.0
	if len(clusters) > 1 {
		minTime := clusters[0].StartTime
		maxTime := clusters[0].EndTime
		for _, cluster := range clusters {
			if cluster.StartTime.Before(minTime) {
				minTime = cluster.StartTime
			}
			if cluster.EndTime.After(maxTime) {
				maxTime = cluster.EndTime
			}
		}
		timeSpread = maxTime.Sub(minTime).Minutes()
	}

	timeScore := 1.0
	if timeSpread > 0 {
		timeScore = math.Max(0.2, 1.0-(timeSpread/10.0)) // 10 minutes = low concentration
	}

	// Combined cascade score
	cascadeScore := (valueScore*0.4 + countScore*0.2 + avgRisk*0.3 + timeScore*0.1)
	return math.Min(cascadeScore, 1.0)
}

// determineRiskLevel determines risk level from cascade score
func (lm *LiquidationMonitor) determineRiskLevel(cascadeScore, totalValue float64) string {
	if cascadeScore >= 0.8 && totalValue >= 2000000 {
		return "CRITICAL"
	} else if cascadeScore >= 0.6 && totalValue >= 1000000 {
		return "HIGH"
	} else if cascadeScore >= 0.4 && totalValue >= 500000 {
		return "MEDIUM"
	} else {
		return "LOW"
	}
}

// predictCascadeImpact predicts the potential impact of the cascade
func (lm *LiquidationMonitor) predictCascadeImpact(cascadeScore, _ float64) string {
	if cascadeScore > 0.8 {
		return "Significant market impact, potential for >1% price move."
	} else if cascadeScore > 0.5 {
		return "Moderate market impact, potential for 0.5-1% price move."
	} else if cascadeScore > 0.2 {
		return "Minor market impact, potential for less than 0.5% price move."
	} else {
		return "No significant market impact."
	}
}

// publishClusterData publishes cluster analysis to Redis
func (lm *LiquidationMonitor) publishClusterData(clusters []LiquidationCluster) error {
	for _, cluster := range clusters {
		data, err := json.Marshal(cluster)
		if err != nil {
			return fmt.Errorf("failed to marshal cluster data: %w", err)
		}

		channel := fmt.Sprintf("%s:liquidation_cluster", lm.symbol)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err = lm.redisClient.Publish(ctx, channel, data).Err()
		if err != nil {
			return fmt.Errorf("failed to publish cluster data: %w", err)
		}

		log.Printf("💥 Liquidation Cluster: %s | %s | $%.0f | Events: %d | Risk: %.3f",
			cluster.ClusterID, cluster.Severity, cluster.TotalValue, cluster.EventCount, cluster.CascadeRisk)
	}

	return nil
}

// publishCascadeAlert publishes cascade alert to Redis
func (lm *LiquidationMonitor) publishCascadeAlert(alert *CascadeAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal cascade alert: %w", err)
	}

	channel := fmt.Sprintf("%s:liquidation_cascade", lm.symbol)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = lm.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish cascade alert: %w", err)
	}

	log.Printf("🚨 CASCADE ALERT: %s | %s | Score: %.3f | $%.0f | Clusters: %d",
		alert.Symbol, alert.RiskLevel, alert.CascadeScore, alert.TotalValue, len(alert.Clusters))

	return nil
}

// Start begins the real liquidation monitoring process
func (lm *LiquidationMonitor) Start(ctx context.Context) error {
	log.Printf("💥 Starting Liquidation Monitor for %s", lm.symbol)

	// Subscribe to real liquidation events
	channel := fmt.Sprintf("%s:liquidation", lm.symbol)
	pubsub := lm.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := lm.ProcessLiquidation([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Liquidation processing error for %s: %v", lm.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the liquidation monitor
func (lm *LiquidationMonitor) Stop() error {
	log.Printf("🛑 Stopping Liquidation Monitor for %s", lm.symbol)
	return nil
}

// Health returns the health status
func (lm *LiquidationMonitor) Health() bool {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	// Check if we have recent events
	if len(lm.recentEvents) == 0 {
		return true // No events is normal
	}

	// Check if latest event is recent (within last 10 minutes)
	latestEvent := lm.recentEvents[len(lm.recentEvents)-1]
	return time.Since(latestEvent.Timestamp) < 10*time.Minute
}

// Name returns the service name
func (lm *LiquidationMonitor) Name() string {
	return fmt.Sprintf("LiquidationMonitor-%s", lm.symbol)
}
