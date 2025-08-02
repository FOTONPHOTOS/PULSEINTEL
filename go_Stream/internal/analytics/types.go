package analytics

import (
	"encoding/json"
	"errors"
	"strconv"
	"time"
)

// TradeData represents the parsed trade data from any exchange
type TradeData struct {
	Symbol    string
	Price     float64
	Quantity  float64
	Side      string
	Timestamp time.Time
}

// BinanceTradeEvent represents the structure of Binance trade events
type BinanceTradeEvent struct {
	Stream string `json:"stream"`
	Data   struct {
		EventType string `json:"e"`
		EventTime int64  `json:"E"`
		Symbol    string `json:"s"`
		Price     string `json:"p"`
		Quantity  string `json:"q"`
		Side      bool   `json:"m"` // true = sell, false = buy
	} `json:"data"`
}

// StandardTradeEvent represents a unified trade event structure for all services
type StandardTradeEvent struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Quantity  float64   `json:"quantity"`
	Side      string    `json:"side"` // "BUY" or "SELL"
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"` // Price * Quantity
}

// ParseBinanceTradeData parses various Binance trade data formats into StandardTradeEvent
func ParseBinanceTradeData(payload string) (*StandardTradeEvent, error) {
	// Try parsing as direct Binance trade data (raw format)
	var rawTrade map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &rawTrade); err == nil {
		if eventType, ok := rawTrade["e"].(string); ok && eventType == "trade" {
			return parseBinanceRawTrade(rawTrade)
		}
	}
	
	// Try parsing as wrapped BinanceTradeEvent
	var binanceEvent BinanceTradeEvent
	if err := json.Unmarshal([]byte(payload), &binanceEvent); err == nil {
		if binanceEvent.Data.EventType == "trade" {
			return parseBinanceEventTrade(binanceEvent)
		}
	}
	
	// Try parsing as double-encoded JSON
	var stringPayload string
	if err := json.Unmarshal([]byte(payload), &stringPayload); err == nil {
		return ParseBinanceTradeData(stringPayload)
	}
	
	return nil, errors.New("invalid trade data format")
}

// parseBinanceRawTrade parses raw Binance trade data
func parseBinanceRawTrade(data map[string]interface{}) (*StandardTradeEvent, error) {
	priceStr, ok := data["p"].(string)
	if !ok {
		return nil, errors.New("missing price field")
	}
	
	quantityStr, ok := data["q"].(string)
	if !ok {
		return nil, errors.New("missing quantity field")
	}
	
	price, err := strconv.ParseFloat(priceStr, 64)
	if err != nil {
		return nil, err
	}
	
	quantity, err := strconv.ParseFloat(quantityStr, 64)
	if err != nil {
		return nil, err
	}
	
	side := "BUY"
	if isSell, ok := data["m"].(bool); ok && isSell {
		side = "SELL"
	}
	
	timestamp := time.Now()
	if eventTime, ok := data["E"].(float64); ok {
		timestamp = time.Unix(int64(eventTime)/1000, 0)
	}
	
	symbol, _ := data["s"].(string)
	
	return &StandardTradeEvent{
		Symbol:    symbol,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: timestamp,
		Value:     price * quantity,
	}, nil
}

// parseBinanceEventTrade parses BinanceTradeEvent into StandardTradeEvent
func parseBinanceEventTrade(event BinanceTradeEvent) (*StandardTradeEvent, error) {
	price, err := strconv.ParseFloat(event.Data.Price, 64)
	if err != nil {
		return nil, err
	}
	
	quantity, err := strconv.ParseFloat(event.Data.Quantity, 64)
	if err != nil {
		return nil, err
	}
	
	side := "BUY"
	if event.Data.Side {
		side = "SELL"
	}
	
	timestamp := time.Unix(event.Data.EventTime/1000, 0)
	
	return &StandardTradeEvent{
		Symbol:    event.Data.Symbol,
		Price:     price,
		Quantity:  quantity,
		Side:      side,
		Timestamp: timestamp,
		Value:     price * quantity,
	}, nil
}

// EventPublisher interface for publishing events
type EventPublisher interface {
	Publish(channel string, data interface{}) error
} 