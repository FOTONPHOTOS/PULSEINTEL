package events

import (
	"context"
	"time"
)

// Core interfaces for microservice architecture
type ExchangeConnector interface {
	Connect(symbol string) error
	Subscribe(channels []string) error
	ReadMessage() ([]byte, error)
	Close() error
	IsConnected() bool
}

type EventPublisher interface {
	Publish(channel string, data interface{}) error
	PublishBatch(events []Event) error
	Close() error
}

type Parser interface {
	ParseOrderBook(data []byte) (*OrderBookDelta, error)
	ParseTrade(data []byte) (*Trade, error)
	ParseLiquidation(data []byte) (*Liquidation, error)
	ParseFunding(data []byte) (*FundingRate, error)
	ParseOI(data []byte) (*OIUpdate, error)
}

type Microservice interface {
	Start(ctx context.Context) error
	Stop() error
	Health() bool
	Name() string
}

// Core event structures
type Event interface {
	GetType() string
	GetSymbol() string
	GetExchange() string
	GetTimestamp() time.Time
}

type OrderBookDelta struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Bids      []Level   `json:"bids"`
	Asks      []Level   `json:"asks"`
	Timestamp time.Time `json:"timestamp"`
}

func (o *OrderBookDelta) GetType() string         { return "orderbook" }
func (o *OrderBookDelta) GetSymbol() string       { return o.Symbol }
func (o *OrderBookDelta) GetExchange() string     { return o.Exchange }
func (o *OrderBookDelta) GetTimestamp() time.Time { return o.Timestamp }

type Level struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
}

type Trade struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Quantity  float64   `json:"quantity"`
	Side      string    `json:"side"` // "BUY" or "SELL"
	Timestamp time.Time `json:"timestamp"`
	TradeID   string    `json:"trade_id"`
}

func (t *Trade) GetType() string         { return "trade" }
func (t *Trade) GetSymbol() string       { return t.Symbol }
func (t *Trade) GetExchange() string     { return t.Exchange }
func (t *Trade) GetTimestamp() time.Time { return t.Timestamp }

type Liquidation struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Quantity  float64   `json:"quantity"`
	Side      string    `json:"side"`
	Timestamp time.Time `json:"timestamp"`
}

func (l *Liquidation) GetType() string         { return "liquidation" }
func (l *Liquidation) GetSymbol() string       { return l.Symbol }
func (l *Liquidation) GetExchange() string     { return l.Exchange }
func (l *Liquidation) GetTimestamp() time.Time { return l.Timestamp }

type FundingRate struct {
	Exchange    string    `json:"exchange"`
	Symbol      string    `json:"symbol"`
	Rate        float64   `json:"rate"`
	NextFunding time.Time `json:"next_funding"`
	Timestamp   time.Time `json:"timestamp"`
}

func (f *FundingRate) GetType() string         { return "funding" }
func (f *FundingRate) GetSymbol() string       { return f.Symbol }
func (f *FundingRate) GetExchange() string     { return f.Exchange }
func (f *FundingRate) GetTimestamp() time.Time { return f.Timestamp }

type OIUpdate struct {
	Exchange      string    `json:"exchange"`
	Symbol        string    `json:"symbol"`
	OpenInterest  float64   `json:"open_interest"`
	Change24h     float64   `json:"change_24h"`
	ChangePercent float64   `json:"change_percent"`
	Timestamp     time.Time `json:"timestamp"`
}

func (o *OIUpdate) GetType() string         { return "oi_update" }
func (o *OIUpdate) GetSymbol() string       { return o.Symbol }
func (o *OIUpdate) GetExchange() string     { return o.Exchange }
func (o *OIUpdate) GetTimestamp() time.Time { return o.Timestamp }

// Analytics event structures
type CVDUpdate struct {
	Exchange   string    `json:"exchange"`
	Symbol     string    `json:"symbol"`
	CVD1m      float64   `json:"cvd_1m"`
	CVD5m      float64   `json:"cvd_5m"`
	CVD15m     float64   `json:"cvd_15m"`
	TradeCount int64     `json:"trade_count"`
	Timestamp  time.Time `json:"timestamp"`
}

func (c *CVDUpdate) GetType() string         { return "cvd_update" }
func (c *CVDUpdate) GetSymbol() string       { return c.Symbol }
func (c *CVDUpdate) GetExchange() string     { return c.Exchange }
func (c *CVDUpdate) GetTimestamp() time.Time { return c.Timestamp }

type WhaleAlert struct {
	Exchange   string    `json:"exchange"`
	Symbol     string    `json:"symbol"`
	Price      float64   `json:"price"`
	Quantity   float64   `json:"quantity"`
	Value      float64   `json:"value"`
	Side       string    `json:"side"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
}

func (w *WhaleAlert) GetType() string         { return "whale_alert" }
func (w *WhaleAlert) GetSymbol() string       { return w.Symbol }
func (w *WhaleAlert) GetExchange() string     { return w.Exchange }
func (w *WhaleAlert) GetTimestamp() time.Time { return w.Timestamp }

type BookImbalance struct {
	Exchange         string    `json:"exchange"`
	Symbol           string    `json:"symbol"`
	BidAskRatio      float64   `json:"bid_ask_ratio"`
	ImbalancePercent float64   `json:"imbalance_percent"`
	Level            string    `json:"level"` // "LOW", "MEDIUM", "HIGH", "EXTREME"
	BiasSide         string    `json:"bias_side"`
	Timestamp        time.Time `json:"timestamp"`
}

func (b *BookImbalance) GetType() string         { return "book_imbalance" }
func (b *BookImbalance) GetSymbol() string       { return b.Symbol }
func (b *BookImbalance) GetExchange() string     { return b.Exchange }
func (b *BookImbalance) GetTimestamp() time.Time { return b.Timestamp }

type MomentumSpike struct {
	Exchange    string        `json:"exchange"`
	Symbol      string        `json:"symbol"`
	PriceDelta  float64       `json:"price_delta"`
	PercentMove float64       `json:"percent_move"`
	TimeWindow  time.Duration `json:"time_window"`
	Severity    string        `json:"severity"` // "LOW", "MEDIUM", "HIGH"
	Timestamp   time.Time     `json:"timestamp"`
}

func (m *MomentumSpike) GetType() string         { return "momentum_spike" }
func (m *MomentumSpike) GetSymbol() string       { return m.Symbol }
func (m *MomentumSpike) GetExchange() string     { return m.Exchange }
func (m *MomentumSpike) GetTimestamp() time.Time { return m.Timestamp }

// Additional detection event types
type SpoofingAlert struct {
	Exchange   string        `json:"exchange"`
	Symbol     string        `json:"symbol"`
	Side       string        `json:"side"`
	Price      float64       `json:"price"`
	Quantity   float64       `json:"quantity"`
	Lifetime   time.Duration `json:"lifetime"`
	Confidence float64       `json:"confidence"`
	Timestamp  time.Time     `json:"timestamp"`
}

func (s *SpoofingAlert) GetType() string         { return "spoofing_alert" }
func (s *SpoofingAlert) GetSymbol() string       { return s.Symbol }
func (s *SpoofingAlert) GetExchange() string     { return s.Exchange }
func (s *SpoofingAlert) GetTimestamp() time.Time { return s.Timestamp }

type IcebergDetection struct {
	Exchange       string    `json:"exchange"`
	Symbol         string    `json:"symbol"`
	Side           string    `json:"side"`
	TotalQuantity  float64   `json:"total_quantity"`
	ExecutedChunks int       `json:"executed_chunks"`
	AverageSize    float64   `json:"average_size"`
	Confidence     float64   `json:"confidence"`
	Timestamp      time.Time `json:"timestamp"`
}

func (i *IcebergDetection) GetType() string         { return "iceberg_detection" }
func (i *IcebergDetection) GetSymbol() string       { return i.Symbol }
func (i *IcebergDetection) GetExchange() string     { return i.Exchange }
func (i *IcebergDetection) GetTimestamp() time.Time { return i.Timestamp }
