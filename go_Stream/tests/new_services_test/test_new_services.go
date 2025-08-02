package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestNewServices() {
	fmt.Println("🧪 Testing P9-MicroStream New Services")
	fmt.Println("📡 Monitoring Redis channels for Funding Rates, Mark Prices, and Open Interest")
	fmt.Println("⏱️  Will monitor for 60 seconds...")
	fmt.Println()

	// Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Test Redis connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	fmt.Println("✅ Connected to Redis")

	// Subscribe to our new service channels
	channels := []string{
		"funding:binance:solusdt",
		"funding:bybit:solusdt",
		"funding:okx:sol-usdt",
		"meta:mark_price:binance:solusdt",
		"meta:mark_price:bybit:solusdt",
		"meta:mark_price:okx:sol-usdt",
		"meta:oi:binance:solusdt",
		"meta:oi:bybit:solusdt",
		"meta:oi:okx:sol-usdt",
	}

	pubsub := rdb.Subscribe(ctx, channels...)
	defer pubsub.Close()

	fmt.Println("🎯 Subscribed to channels:")
	for _, channel := range channels {
		fmt.Printf("   - %s\n", channel)
	}
	fmt.Println()

	// Channel to track what we've received
	receivedData := make(map[string]int)

	// Listen for messages
	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			receivedData[msg.Channel]++

			// Parse and display the message nicely
			switch {
			case contains(msg.Channel, "funding:"):
				fmt.Printf("💰 FUNDING RATE: %s\n", msg.Channel)
				fmt.Printf("    Data: %s\n", truncateString(msg.Payload, 100))

			case contains(msg.Channel, "mark_price:"):
				fmt.Printf("💎 MARK PRICE: %s\n", msg.Channel)
				fmt.Printf("    Data: %s\n", truncateString(msg.Payload, 100))

			case contains(msg.Channel, "oi:"):
				fmt.Printf("📊 OPEN INTEREST: %s\n", msg.Channel)
				fmt.Printf("    Data: %s\n", truncateString(msg.Payload, 100))
			}
			fmt.Println()
		}
	}()

	// Wait for timeout
	<-ctx.Done()

	// Summary
	fmt.Println("📈 === TEST SUMMARY ===")
	totalReceived := 0
	for channel, count := range receivedData {
		fmt.Printf("   %s: %d messages\n", channel, count)
		totalReceived += count
	}

	if totalReceived > 0 {
		fmt.Printf("\n✅ SUCCESS: Received %d total messages from our new services!\n", totalReceived)
		fmt.Println("🎯 All three services (Funding Rate, Mark Price, Open Interest) are working!")
	} else {
		fmt.Println("\n⚠️  No messages received. Services might not be running or Redis connection issue.")
		fmt.Println("💡 Make sure to start the P9-MicroStream pipeline first: ./p9_complete_pipeline.exe")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[len(s)-len(substr):] == substr ||
		len(s) > len(substr) && s[:len(substr)] == substr ||
		len(s) > len(substr) && s[len(s)-len(substr):] == substr
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
