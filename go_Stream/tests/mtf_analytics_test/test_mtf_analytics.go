package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestMTFAnalytics() {
	fmt.Println("🧪 Testing P9-MicroStream Multi-timeframe Analytics")
	fmt.Println("📊 Monitoring Redis channels for OHLCV, Order Flow, and OrderBook data")

	// Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	})

	ctx := context.Background()

	// Test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// Subscribe to multi-timeframe analytics channels
	channels := []string{
		// OHLCV Candles
		"candles:SOLUSDT:1s",
		"candles:SOLUSDT:1m",
		"candles:SOLUSDT:5m",
		"candles:SOLUSDT:1h",
		"candles:SOLUSDT:1d",

		// Order Flow
		"orderflow:SOLUSDT",

		// OrderBook Analysis
		"orderbook:SOLUSDT",

		// Original channels for comparison
		"binance:solusdt:trade",
		"bybit:solusdt:trade",
		"okx:sol-usdt:trade",
	}

	pubsub := rdb.Subscribe(ctx, channels...)
	defer pubsub.Close()

	fmt.Printf("✅ Subscribed to %d channels\n", len(channels))
	fmt.Println("🎯 Expected data streams:")
	fmt.Println("   📈 OHLCV Candles: Real-time multi-timeframe candles")
	fmt.Println("   💰 Order Flow: Enhanced trade analysis with whale detection")
	fmt.Println("   📚 OrderBook: Liquidity analysis with wall detection")
	fmt.Println("\n🔄 Listening for messages... (Press Ctrl+C to stop)")

	messageCount := make(map[string]int)
	startTime := time.Now()

	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			log.Printf("Error receiving message: %v", err)
			continue
		}

		messageCount[msg.Channel]++
		elapsed := time.Since(startTime)

		// Display different types of messages
		switch {
		case contains(msg.Channel, "candles:"):
			fmt.Printf("🕯️  [%s] OHLCV Candle: %s (total: %d)\n",
				elapsed.Truncate(time.Second), msg.Channel, messageCount[msg.Channel])

		case contains(msg.Channel, "orderflow:"):
			fmt.Printf("📊 [%s] Order Flow: %s (total: %d)\n",
				elapsed.Truncate(time.Second), msg.Channel, messageCount[msg.Channel])

		case contains(msg.Channel, "orderbook:"):
			fmt.Printf("📚 [%s] OrderBook: %s (total: %d)\n",
				elapsed.Truncate(time.Second), msg.Channel, messageCount[msg.Channel])

		case contains(msg.Channel, "trade"):
			fmt.Printf("💸 [%s] Raw Trade: %s (total: %d)\n",
				elapsed.Truncate(time.Second), msg.Channel, messageCount[msg.Channel])
		}

		// Print summary every 30 seconds
		if int(elapsed.Seconds())%30 == 0 && int(elapsed.Seconds()) > 0 {
			printSummary(messageCount, elapsed)
		}
	}
}

func printSummary(messageCount map[string]int, elapsed time.Duration) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Printf("📊 SUMMARY AFTER %s\n", elapsed.Truncate(time.Second))
	fmt.Println(strings.Repeat("=", 60))

	totalMessages := 0
	candleCount := 0
	flowCount := 0
	bookCount := 0
	tradeCount := 0

	for channel, count := range messageCount {
		totalMessages += count
		switch {
		case contains(channel, "candles:"):
			candleCount += count
		case contains(channel, "orderflow:"):
			flowCount += count
		case contains(channel, "orderbook:"):
			bookCount += count
		case contains(channel, "trade"):
			tradeCount += count
		}
		fmt.Printf("   %s: %d messages\n", channel, count)
	}

	fmt.Printf("\n🎯 ANALYTICS PERFORMANCE:\n")
	fmt.Printf("   🕯️  OHLCV Candles: %d\n", candleCount)
	fmt.Printf("   📊 Order Flow Events: %d\n", flowCount)
	fmt.Printf("   📚 OrderBook Updates: %d\n", bookCount)
	fmt.Printf("   💸 Raw Trades: %d\n", tradeCount)
	fmt.Printf("   📈 Total Messages: %d\n", totalMessages)
	fmt.Printf("   ⚡ Rate: %.2f msg/sec\n", float64(totalMessages)/elapsed.Seconds())
	fmt.Println(strings.Repeat("=", 60) + "\n")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && findInString(s, substr)
}

func findInString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
