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

// LiquidityLevel represents a single price level with liquidity data
type LiquidityLevel struct {
	Price      float64 `json:"price"`
	Volume     float64 `json:"volume"`
	OrderCount int     `json:"order_count"`
	Depth      float64 `json:"depth"` // Cumulative volume to this level
}

// LiquidityVacuum represents a detected liquidity gap
type LiquidityVacuum struct {
	VacuumID         string    `json:"vacuum_id"`
	StartPrice       float64   `json:"start_price"`
	EndPrice         float64   `json:"end_price"`
	PriceRange       float64   `json:"price_range"`
	VacuumStrength   float64   `json:"vacuum_strength"`   // 0.0-1.0
	MissingLiquidity float64   `json:"missing_liquidity"` // Expected vs actual liquidity
	Side             string    `json:"side"`              // "BID", "ASK", "BOTH"
	Depth            float64   `json:"depth"`             // Distance from current price
	OpportunityScore float64   `json:"opportunity_score"` // Predator opportunity rating
	DetectionTime    time.Time `json:"detection_time"`
	ExpiryTime       time.Time `json:"expiry_time"`
	IsActive         bool      `json:"is_active"`
}

// LiquidityProfile represents the complete liquidity landscape
type LiquidityProfile struct {
	Symbol             string            `json:"symbol"`
	CurrentPrice       float64           `json:"current_price"`
	BidLiquidity       []LiquidityLevel  `json:"bid_liquidity"`
	AskLiquidity       []LiquidityLevel  `json:"ask_liquidity"`
	TotalBidDepth      float64           `json:"total_bid_depth"`
	TotalAskDepth      float64           `json:"total_ask_depth"`
	LiquidityImbalance float64           `json:"liquidity_imbalance"` // -1.0 to 1.0
	VacuumZones        []LiquidityVacuum `json:"vacuum_zones"`
	QualityScore       float64           `json:"quality_score"` // Overall liquidity quality
	Timestamp          time.Time         `json:"timestamp"`
}

// VacuumAlert represents a liquidity vacuum alert for trading
type VacuumAlert struct {
	Symbol            string            `json:"symbol"`
	AlertType         string            `json:"alert_type"` // "VACUUM_DETECTED", "VACUUM_FILLED", "OPPORTUNITY"
	PrimaryVacuum     LiquidityVacuum   `json:"primary_vacuum"`
	AllVacuums        []LiquidityVacuum `json:"all_vacuums"`
	TotalOpportunity  float64           `json:"total_opportunity"`  // Combined opportunity score
	RecommendedAction string            `json:"recommended_action"` // "HUNT", "WAIT", "AVOID"
	RiskLevel         string            `json:"risk_level"`         // "LOW", "MEDIUM", "HIGH"
	PredatorAdvantage float64           `json:"predator_advantage"` // Advantage for predator trading
	Timestamp         time.Time         `json:"timestamp"`
}

// LiquidityVacuumAnalyzer detects and analyzes real liquidity vacuums
type LiquidityVacuumAnalyzer struct {
	redisClient *redis.Client
	symbol      string

	// Current market state
	currentProfile  *LiquidityProfile
	priceHistory    []float64
	maxPriceHistory int

	// Vacuum detection parameters
	minVacuumSize      float64 // Minimum price range for vacuum (percentage)
	minVacuumStrength  float64 // Minimum strength threshold
	liquidityThreshold float64 // Expected liquidity threshold
	depthLevels        int     // Number of order book levels to analyze

	// Active vacuum tracking
	activeVacuums    []LiquidityVacuum
	maxActiveVacuums int
	vacuumTTL        time.Duration

	// Analysis parameters
	analysisDepth float64 // Price range to analyze (percentage from current price)
	qualityWeight float64 // Weight for liquidity quality calculation

	mu               sync.RWMutex
	lastAnalysis     time.Time
	analysisInterval time.Duration
}

// NewLiquidityVacuumAnalyzer creates a new real liquidity vacuum analyzer
func NewLiquidityVacuumAnalyzer(redisClient *redis.Client, symbol string) *LiquidityVacuumAnalyzer {
	return &LiquidityVacuumAnalyzer{
		redisClient:        redisClient,
		symbol:             symbol,
		maxPriceHistory:    100,
		minVacuumSize:      0.001,  // 0.1% minimum vacuum size
		minVacuumStrength:  0.3,    // 30% minimum vacuum strength
		liquidityThreshold: 1000.0, // Minimum expected liquidity
		depthLevels:        20,     // Analyze top 20 levels
		maxActiveVacuums:   10,
		vacuumTTL:          5 * time.Minute,
		analysisDepth:      0.02, // Analyze 2% range around current price
		qualityWeight:      0.7,
		analysisInterval:   3 * time.Second,
		priceHistory:       make([]float64, 0, 100),
		activeVacuums:      make([]LiquidityVacuum, 0, 10),
	}
}

// ProcessOrderBook processes real order book data for vacuum detection
func (lva *LiquidityVacuumAnalyzer) ProcessOrderBook(orderBookData []byte) error {
	lva.mu.Lock()
	defer lva.mu.Unlock()

	// Parse real order book data
	var orderBook struct {
		Symbol    string      `json:"symbol"`
		Bids      [][]float64 `json:"bids"` // [price, volume]
		Asks      [][]float64 `json:"asks"` // [price, volume]
		Timestamp time.Time   `json:"timestamp"`
	}

	if err := json.Unmarshal(orderBookData, &orderBook); err != nil {
		return fmt.Errorf("failed to parse order book: %w", err)
	}

	// Validate real data
	if orderBook.Symbol != lva.symbol || len(orderBook.Bids) == 0 || len(orderBook.Asks) == 0 {
		return fmt.Errorf("invalid order book data: symbol=%s, bids=%d, asks=%d",
			orderBook.Symbol, len(orderBook.Bids), len(orderBook.Asks))
	}

	// Get current price (best bid/ask midpoint)
	bestBid := orderBook.Bids[0][0]
	bestAsk := orderBook.Asks[0][0]
	currentPrice := (bestBid + bestAsk) / 2.0

	// Update price history
	lva.priceHistory = append(lva.priceHistory, currentPrice)
	if len(lva.priceHistory) > lva.maxPriceHistory {
		lva.priceHistory = lva.priceHistory[1:]
	}

	// Convert order book to liquidity levels
	bidLiquidity := lva.convertToLiquidityLevels(orderBook.Bids, true)
	askLiquidity := lva.convertToLiquidityLevels(orderBook.Asks, false)

	// Create liquidity profile
	profile := lva.createLiquidityProfile(currentPrice, bidLiquidity, askLiquidity)
	lva.currentProfile = profile

	// Detect liquidity vacuums
	vacuums := lva.detectLiquidityVacuums(profile)

	// Update active vacuums
	lva.updateActiveVacuums(vacuums)

	// Clean expired vacuums
	lva.cleanExpiredVacuums()

	// Perform analysis if enough time has passed
	now := time.Now()
	if now.Sub(lva.lastAnalysis) >= lva.analysisInterval {
		alert := lva.generateVacuumAlert()
		if alert != nil {
			lva.publishVacuumAlert(alert)
		}
		lva.lastAnalysis = now
	}

	return nil
}

// convertToLiquidityLevels converts raw order book data to liquidity levels
func (lva *LiquidityVacuumAnalyzer) convertToLiquidityLevels(levels [][]float64, isBid bool) []LiquidityLevel {
	_ = isBid // Mark as used to avoid compiler warning
	liquidityLevels := make([]LiquidityLevel, 0, len(levels))
	cumulativeDepth := 0.0

	// Limit to analysis depth
	maxLevels := lva.depthLevels
	if len(levels) < maxLevels {
		maxLevels = len(levels)
	}

	for i := 0; i < maxLevels; i++ {
		if len(levels[i]) < 2 {
			continue
		}

		price := levels[i][0]
		volume := levels[i][1]
		cumulativeDepth += volume

		liquidityLevels = append(liquidityLevels, LiquidityLevel{
			Price:      price,
			Volume:     volume,
			OrderCount: 1, // Simplified - real implementation would count orders
			Depth:      cumulativeDepth,
		})
	}

	return liquidityLevels
}

// createLiquidityProfile creates a comprehensive liquidity profile
func (lva *LiquidityVacuumAnalyzer) createLiquidityProfile(currentPrice float64,
	bidLiquidity, askLiquidity []LiquidityLevel) *LiquidityProfile {

	// Calculate total depths
	totalBidDepth := 0.0
	totalAskDepth := 0.0

	if len(bidLiquidity) > 0 {
		totalBidDepth = bidLiquidity[len(bidLiquidity)-1].Depth
	}
	if len(askLiquidity) > 0 {
		totalAskDepth = askLiquidity[len(askLiquidity)-1].Depth
	}

	// Calculate liquidity imbalance
	totalDepth := totalBidDepth + totalAskDepth
	liquidityImbalance := 0.0
	if totalDepth > 0 {
		liquidityImbalance = (totalBidDepth - totalAskDepth) / totalDepth
	}

	// Calculate quality score
	qualityScore := lva.calculateLiquidityQuality(bidLiquidity, askLiquidity, currentPrice)

	return &LiquidityProfile{
		Symbol:             lva.symbol,
		CurrentPrice:       currentPrice,
		BidLiquidity:       bidLiquidity,
		AskLiquidity:       askLiquidity,
		TotalBidDepth:      totalBidDepth,
		TotalAskDepth:      totalAskDepth,
		LiquidityImbalance: liquidityImbalance,
		QualityScore:       qualityScore,
		Timestamp:          time.Now(),
	}
}

// calculateLiquidityQuality calculates overall liquidity quality score
func (lva *LiquidityVacuumAnalyzer) calculateLiquidityQuality(bidLiquidity, askLiquidity []LiquidityLevel, currentPrice float64) float64 {
	if len(bidLiquidity) == 0 || len(askLiquidity) == 0 {
		return 0.0
	}

	// Calculate spread quality
	bestBid := bidLiquidity[0].Price
	bestAsk := askLiquidity[0].Price
	spread := (bestAsk - bestBid) / currentPrice
	spreadQuality := math.Max(0.0, 1.0-(spread*1000)) // Normalize spread

	// Calculate depth quality
	depthQuality := math.Min(1.0, (bidLiquidity[0].Volume+askLiquidity[0].Volume)/lva.liquidityThreshold)

	// Calculate distribution quality (how evenly distributed is liquidity)
	bidDistribution := lva.calculateDistributionQuality(bidLiquidity)
	askDistribution := lva.calculateDistributionQuality(askLiquidity)
	distributionQuality := (bidDistribution + askDistribution) / 2.0

	// Weighted quality score
	qualityScore := (spreadQuality*0.4 + depthQuality*0.4 + distributionQuality*0.2)
	return math.Min(qualityScore, 1.0)
}

// calculateDistributionQuality calculates how evenly liquidity is distributed
func (lva *LiquidityVacuumAnalyzer) calculateDistributionQuality(levels []LiquidityLevel) float64 {
	if len(levels) < 3 {
		return 0.5 // Default quality for insufficient data
	}

	// Calculate coefficient of variation for volume distribution
	volumes := make([]float64, len(levels))
	sum := 0.0

	for i, level := range levels {
		volumes[i] = level.Volume
		sum += level.Volume
	}

	if sum == 0 {
		return 0.0
	}

	mean := sum / float64(len(volumes))

	// Calculate variance
	variance := 0.0
	for _, volume := range volumes {
		diff := volume - mean
		variance += diff * diff
	}
	variance /= float64(len(volumes))

	if mean == 0 {
		return 0.0
	}

	// Coefficient of variation (lower is better distribution)
	cv := math.Sqrt(variance) / mean

	// Convert to quality score (lower CV = higher quality)
	return math.Max(0.0, 1.0-cv)
}

// detectLiquidityVacuums detects liquidity vacuums in the order book
func (lva *LiquidityVacuumAnalyzer) detectLiquidityVacuums(profile *LiquidityProfile) []LiquidityVacuum {
	var vacuums []LiquidityVacuum

	// Detect bid-side vacuums
	bidVacuums := lva.detectSideVacuums(profile.BidLiquidity, profile.CurrentPrice, "BID", false)
	vacuums = append(vacuums, bidVacuums...)

	// Detect ask-side vacuums
	askVacuums := lva.detectSideVacuums(profile.AskLiquidity, profile.CurrentPrice, "ASK", true)
	vacuums = append(vacuums, askVacuums...)

	// Detect cross-side vacuums (gaps spanning both sides)
	crossVacuums := lva.detectCrossSideVacuums(profile)
	vacuums = append(vacuums, crossVacuums...)

	return vacuums
}

// detectSideVacuums detects vacuums on one side of the order book
func (lva *LiquidityVacuumAnalyzer) detectSideVacuums(levels []LiquidityLevel, currentPrice float64, side string, isAsk bool) []LiquidityVacuum {
	var vacuums []LiquidityVacuum

	if len(levels) < 3 {
		return vacuums
	}

	// Calculate expected liquidity based on recent levels
	avgVolume := lva.calculateAverageVolume(levels)
	expectedLiquidity := avgVolume * 0.5 // 50% of average as minimum expected

	// Scan for gaps in liquidity
	for i := 0; i < len(levels)-1; i++ {
		currentLevel := levels[i]
		nextLevel := levels[i+1]

		// Check for price gap
		var priceGap float64
		if isAsk {
			priceGap = nextLevel.Price - currentLevel.Price
		} else {
			priceGap = currentLevel.Price - nextLevel.Price
		}

		// Check if gap is significant
		gapPercentage := priceGap / currentPrice
		if gapPercentage < lva.minVacuumSize {
			continue
		}

		// Check for liquidity deficiency
		avgLevelVolume := (currentLevel.Volume + nextLevel.Volume) / 2.0
		if avgLevelVolume >= expectedLiquidity {
			continue // Sufficient liquidity
		}

		// Calculate vacuum strength
		liquidityDeficit := expectedLiquidity - avgLevelVolume
		vacuumStrength := liquidityDeficit / expectedLiquidity

		if vacuumStrength < lva.minVacuumStrength {
			continue
		}

		// Calculate opportunity score
		depth := math.Abs(currentLevel.Price-currentPrice) / currentPrice
		opportunityScore := lva.calculateOpportunityScore(vacuumStrength, gapPercentage, depth)

		// Create vacuum
		vacuum := LiquidityVacuum{
			VacuumID:         fmt.Sprintf("%s-%s-%d-%d", lva.symbol, side, time.Now().Unix(), i),
			StartPrice:       math.Min(currentLevel.Price, nextLevel.Price),
			EndPrice:         math.Max(currentLevel.Price, nextLevel.Price),
			PriceRange:       priceGap,
			VacuumStrength:   vacuumStrength,
			MissingLiquidity: liquidityDeficit,
			Side:             side,
			Depth:            depth,
			OpportunityScore: opportunityScore,
			DetectionTime:    time.Now(),
			ExpiryTime:       time.Now().Add(lva.vacuumTTL),
			IsActive:         true,
		}

		vacuums = append(vacuums, vacuum)
	}

	return vacuums
}

// detectCrossSideVacuums detects vacuums that span both bid and ask sides
func (lva *LiquidityVacuumAnalyzer) detectCrossSideVacuums(profile *LiquidityProfile) []LiquidityVacuum {
	var vacuums []LiquidityVacuum

	if len(profile.BidLiquidity) == 0 || len(profile.AskLiquidity) == 0 {
		return vacuums
	}

	bestBid := profile.BidLiquidity[0].Price
	bestAsk := profile.AskLiquidity[0].Price
	spread := bestAsk - bestBid

	// Check if spread is abnormally wide
	normalSpread := profile.CurrentPrice * 0.001 // 0.1% as normal spread
	if spread > normalSpread*3 {                 // 3x normal spread
		vacuumStrength := math.Min(1.0, spread/(normalSpread*5))

		vacuum := LiquidityVacuum{
			VacuumID:         fmt.Sprintf("%s-CROSS-%d", lva.symbol, time.Now().Unix()),
			StartPrice:       bestBid,
			EndPrice:         bestAsk,
			PriceRange:       spread,
			VacuumStrength:   vacuumStrength,
			MissingLiquidity: normalSpread * 2, // Expected liquidity in spread
			Side:             "BOTH",
			Depth:            0.0,                  // At current price
			OpportunityScore: vacuumStrength * 0.8, // High opportunity for wide spreads
			DetectionTime:    time.Now(),
			ExpiryTime:       time.Now().Add(lva.vacuumTTL),
			IsActive:         true,
		}

		vacuums = append(vacuums, vacuum)
	}

	return vacuums
}

// calculateAverageVolume calculates average volume across levels
func (lva *LiquidityVacuumAnalyzer) calculateAverageVolume(levels []LiquidityLevel) float64 {
	if len(levels) == 0 {
		return 0.0
	}

	totalVolume := 0.0
	for _, level := range levels {
		totalVolume += level.Volume
	}

	return totalVolume / float64(len(levels))
}

// calculateOpportunityScore calculates predator opportunity score for a vacuum
func (lva *LiquidityVacuumAnalyzer) calculateOpportunityScore(vacuumStrength, gapPercentage, depth float64) float64 {
	// Base score from vacuum strength
	baseScore := vacuumStrength

	// Boost for larger gaps
	gapBonus := math.Min(gapPercentage*100, 0.5) // Max 50% bonus for gap size

	// Penalty for depth (closer to current price = better opportunity)
	depthPenalty := depth * 2.0 // Linear penalty for depth

	// Calculate final score
	opportunityScore := baseScore + gapBonus - depthPenalty
	return math.Max(0.0, math.Min(opportunityScore, 1.0))
}

// updateActiveVacuums updates the list of active vacuums
func (lva *LiquidityVacuumAnalyzer) updateActiveVacuums(newVacuums []LiquidityVacuum) {
	// Add new vacuums
	for _, vacuum := range newVacuums {
		// Check if similar vacuum already exists
		exists := false
		for _, active := range lva.activeVacuums {
			if lva.isSimilarVacuum(vacuum, active) {
				exists = true
				break
			}
		}

		if !exists {
			lva.activeVacuums = append(lva.activeVacuums, vacuum)
		}
	}

	// Sort by opportunity score
	sort.Slice(lva.activeVacuums, func(i, j int) bool {
		return lva.activeVacuums[i].OpportunityScore > lva.activeVacuums[j].OpportunityScore
	})

	// Limit active vacuums
	if len(lva.activeVacuums) > lva.maxActiveVacuums {
		lva.activeVacuums = lva.activeVacuums[:lva.maxActiveVacuums]
	}
}

// isSimilarVacuum checks if two vacuums are similar (to avoid duplicates)
func (lva *LiquidityVacuumAnalyzer) isSimilarVacuum(vacuum1, vacuum2 LiquidityVacuum) bool {
	// Check price range overlap
	priceOverlap := !(vacuum1.EndPrice < vacuum2.StartPrice || vacuum2.EndPrice < vacuum1.StartPrice)

	// Check side match
	sideMatch := vacuum1.Side == vacuum2.Side

	return priceOverlap && sideMatch
}

// cleanExpiredVacuums removes expired vacuums
func (lva *LiquidityVacuumAnalyzer) cleanExpiredVacuums() {
	now := time.Now()
	validVacuums := make([]LiquidityVacuum, 0, len(lva.activeVacuums))

	for _, vacuum := range lva.activeVacuums {
		if vacuum.ExpiryTime.After(now) {
			validVacuums = append(validVacuums, vacuum)
		}
	}

	lva.activeVacuums = validVacuums
}

// generateVacuumAlert generates vacuum alert for trading
func (lva *LiquidityVacuumAnalyzer) generateVacuumAlert() *VacuumAlert {
	if len(lva.activeVacuums) == 0 {
		return nil
	}

	// Get primary vacuum (highest opportunity score)
	primaryVacuum := lva.activeVacuums[0]

	// Calculate total opportunity
	totalOpportunity := 0.0
	for _, vacuum := range lva.activeVacuums {
		totalOpportunity += vacuum.OpportunityScore
	}
	totalOpportunity = math.Min(totalOpportunity, 1.0)

	// Determine alert type
	alertType := "VACUUM_DETECTED"
	if primaryVacuum.OpportunityScore > 0.8 {
		alertType = "OPPORTUNITY"
	}

	// Determine recommended action
	recommendedAction := lva.determineRecommendedAction(primaryVacuum, totalOpportunity)

	// Assess risk level
	riskLevel := lva.assessRiskLevel(primaryVacuum, totalOpportunity)

	// Calculate predator advantage
	predatorAdvantage := lva.calculatePredatorAdvantage(primaryVacuum, totalOpportunity)

	return &VacuumAlert{
		Symbol:            lva.symbol,
		AlertType:         alertType,
		PrimaryVacuum:     primaryVacuum,
		AllVacuums:        lva.activeVacuums,
		TotalOpportunity:  totalOpportunity,
		RecommendedAction: recommendedAction,
		RiskLevel:         riskLevel,
		PredatorAdvantage: predatorAdvantage,
		Timestamp:         time.Now(),
	}
}

// determineRecommendedAction determines recommended trading action
func (lva *LiquidityVacuumAnalyzer) determineRecommendedAction(primaryVacuum LiquidityVacuum, totalOpportunity float64) string {
	_ = totalOpportunity // Mark as used to avoid compiler warning
	if primaryVacuum.OpportunityScore > 0.8 && totalOpportunity > 0.6 {
		return "HUNT"
	} else if primaryVacuum.OpportunityScore > 0.5 {
		return "WAIT"
	} else {
		return "AVOID"
	}
}

// assessRiskLevel assesses risk level for vacuum trading
func (lva *LiquidityVacuumAnalyzer) assessRiskLevel(primaryVacuum LiquidityVacuum, _ float64) string {
	risk := "LOW"
	if primaryVacuum.VacuumStrength > 0.7 {
		risk = "HIGH"
	}
	return risk
}

// calculatePredatorAdvantage calculates advantage for predator trading
func (lva *LiquidityVacuumAnalyzer) calculatePredatorAdvantage(primaryVacuum LiquidityVacuum, totalOpportunity float64) float64 {
	// Base advantage from vacuum strength
	baseAdvantage := primaryVacuum.VacuumStrength

	// Boost from multiple vacuums
	multiVacuumBoost := math.Min(totalOpportunity*0.3, 0.3)

	// Proximity bonus (closer to current price = better)
	proximityBonus := math.Max(0.0, 0.2-(primaryVacuum.Depth*2.0))

	advantage := baseAdvantage + multiVacuumBoost + proximityBonus
	return math.Min(advantage, 1.0)
}

// publishVacuumAlert publishes vacuum alert to Redis
func (lva *LiquidityVacuumAnalyzer) publishVacuumAlert(alert *VacuumAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal vacuum alert: %w", err)
	}

	channel := fmt.Sprintf("%s:liquidity_vacuum", lva.symbol)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = lva.redisClient.Publish(ctx, channel, data).Err()
	if err != nil {
		return fmt.Errorf("failed to publish vacuum alert: %w", err)
	}

	log.Printf("🕳️ Liquidity Vacuum: %s | %s | Strength: %.3f | Opportunity: %.3f | Action: %s",
		alert.Symbol, alert.AlertType, alert.PrimaryVacuum.VacuumStrength,
		alert.TotalOpportunity, alert.RecommendedAction)

	return nil
}

// Start begins the real liquidity vacuum analysis process
func (lva *LiquidityVacuumAnalyzer) Start(ctx context.Context) error {
	log.Printf("🕳️ Starting Liquidity Vacuum Analyzer for %s", lva.symbol)

	// Subscribe to real order book events
	channel := fmt.Sprintf("%s:orderbook", lva.symbol)
	pubsub := lva.redisClient.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			if err := lva.ProcessOrderBook([]byte(msg.Payload)); err != nil {
				log.Printf("❌ Liquidity vacuum processing error for %s: %v", lva.symbol, err)
			}
		}
	}
}

// Stop gracefully stops the liquidity vacuum analyzer
func (lva *LiquidityVacuumAnalyzer) Stop() error {
	log.Printf("🛑 Stopping Liquidity Vacuum Analyzer for %s", lva.symbol)
	return nil
}

// Health returns the health status
func (lva *LiquidityVacuumAnalyzer) Health() bool {
	lva.mu.RLock()
	defer lva.mu.RUnlock()

	// Check if we have recent profile data
	if lva.currentProfile == nil {
		return false
	}

	// Check if data is recent (within last 30 seconds)
	return time.Since(lva.currentProfile.Timestamp) < 30*time.Second
}

// Name returns the service name
func (lva *LiquidityVacuumAnalyzer) Name() string {
	return fmt.Sprintf("LiquidityVacuumAnalyzer-%s", lva.symbol)
}
