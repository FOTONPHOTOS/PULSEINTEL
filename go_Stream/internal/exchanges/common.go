package exchanges

import (
	"strconv"
)

// StandardizedTrade represents a trade in a common format.
type StandardizedTrade struct {
	Type      string  `json:"type"`
	Exchange  string  `json:"exchange"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Timestamp int64   `json:"timestamp"`
}

// StandardizedDepth represents an order book update in a common format.
type StandardizedDepth struct {
	Type      string      `json:"type"`
	Exchange  string      `json:"exchange"`
	Symbol    string      `json:"symbol"`
	Timestamp int64       `json:"timestamp"`
	Bids      [][]float64 `json:"bids"`
	Asks      [][]float64 `json:"asks"`
}

// Helper function to convert string pairs to float64 pairs.
func convertStringPairsToFloat(pairs [][]string) ([][]float64, error) {
	result := make([][]float64, len(pairs))
	for i, pair := range pairs {
		if len(pair) != 2 {
			continue // Or return an error
		}
		price, err := strconv.ParseFloat(pair[0], 64)
		if err != nil {
			return nil, err
		}
		quantity, err := strconv.ParseFloat(pair[1], 64)
		if err != nil {
			return nil, err
		}
		result[i] = []float64{price, quantity}
	}
	return result, nil
}
