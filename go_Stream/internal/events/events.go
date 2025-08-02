package events

import "time"

// OrderBookDelta represents an incremental update to the order book.
type OrderBookDelta struct {
	Exchange  string      `json:"exchange"`
	Symbol    string      `json:"symbol"`
	Timestamp time.Time   `json:"timestamp"`
	Bids      [][2]string `json:"bids"` // [price, size]
	Asks      [][2]string `json:"asks"` // [price, size]
}
