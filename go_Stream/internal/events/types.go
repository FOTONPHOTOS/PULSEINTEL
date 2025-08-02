package events

import "time"

type Trade struct {
Exchange     string    `json:"exchange"`
Symbol       string    `json:"symbol"`
TradeID      string    `json:"trade_id"`
Price        float64   `json:"price"`
Quantity     float64   `json:"quantity"`
Side         string    `json:"side"`
Timestamp    time.Time `json:"timestamp"`
IsBuyerMaker bool      `json:"is_buyer_maker"`
Value        float64   `json:"value"`
}

type OHLCVCandle struct {
Exchange    string    `json:"exchange"`
Symbol      string    `json:"symbol"`
Timeframe   string    `json:"timeframe"`
OpenTime    time.Time `json:"open_time"`
CloseTime   time.Time `json:"close_time"`
Open        float64   `json:"open"`
High        float64   `json:"high"`
Low         float64   `json:"low"`
Close       float64   `json:"close"`
Volume      float64   `json:"volume"`
QuoteVolume float64   `json:"quote_volume"`
TradeCount  int64     `json:"trade_count"`
TakerBuyVolume float64 `json:"taker_buy_volume"`
TakerBuyQuoteVolume float64 `json:"taker_buy_quote_volume"`
VWAP        float64   `json:"vwap"`
IsComplete  bool      `json:"is_complete"`
IsHistorical bool     `json:"is_historical"`
Timestamp   time.Time `json:"timestamp"`
}
