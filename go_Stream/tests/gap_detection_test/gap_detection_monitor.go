package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

// GapDetectionEvent represents a detected gap event
type GapDetectionEvent struct {
	Exchange         string    `json:"exchange"`
	Symbol           string    `json:"symbol"`
	ExpectedSequence int64     `json:"expected_sequence"`
	ReceivedSequence int64     `json:"received_sequence"`
	GapSize          int64     `json:"gap_size"`
	Timestamp        time.Time `json:"timestamp"`
	Action           string    `json:"action"`
}

// SnapshotRequest represents a snapshot request
type SnapshotRequest struct {
	Exchange  string    `json:"exchange"`
	Symbol    string    `json:"symbol"`
	Reason    string    `json:"reason"`
	GapSize   int64     `json:"gap_size"`
	Timestamp time.Time `json:"timestamp"`
	Priority  string    `json:"priority"`
}

func main() {
	fmt.Println("🔍 === P9-MICROSTREAM GAP DETECTION MONITOR ===")
	fmt.Println("📡 Monitoring gap detection and snapshot request channels...")
	fmt.Println("Press Ctrl+C to stop")
	fmt.Println()

	// Connect to Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	ctx := context.Background()

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("❌ Failed to connect to Redis: %v", err)
	}

	fmt.Println("✅ Connected to Redis successfully")

	// Subscribe to gap detection and snapshot request channels
	pubsub := redisClient.Subscribe(ctx,
		"gap_detection",     // Gap detection events
		"snapshot_requests", // Snapshot requests
	)
	defer pubsub.Close()

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Statistics tracking
	gapEvents := 0
	snapshotRequests := 0
	startTime := time.Now()

	fmt.Println("🚀 Started monitoring gap detection channels...")
	fmt.Println("   - gap_detection: Gap detection events")
	fmt.Println("   - snapshot_requests: Snapshot requests")
	fmt.Println()

	// Message processing loop
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				msg, err := pubsub.ReceiveMessage(ctx)
				if err != nil {
					if err == context.Canceled {
						return
					}
					log.Printf("❌ Error receiving message: %v", err)
					continue
				}

				// Process message based on channel
				switch msg.Channel {
				case "gap_detection":
					processGapDetectionEvent(msg.Payload)
					gapEvents++

				case "snapshot_requests":
					processSnapshotRequest(msg.Payload)
					snapshotRequests++
				}
			}
		}
	}()

	// Statistics reporting loop
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				duration := time.Since(startTime)
				fmt.Printf("📊 STATISTICS (running for %v):\n", duration.Round(time.Second))
				fmt.Printf("   Gap Events: %d\n", gapEvents)
				fmt.Printf("   Snapshot Requests: %d\n", snapshotRequests)
				fmt.Printf("   Events/min: %.1f\n", float64(gapEvents+snapshotRequests)/(duration.Minutes()))
				fmt.Println()
			}
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	fmt.Println("\n🛑 Shutdown signal received, stopping monitor...")

	// Final statistics
	duration := time.Since(startTime)
	fmt.Printf("📊 FINAL STATISTICS (ran for %v):\n", duration.Round(time.Second))
	fmt.Printf("   Gap Events: %d\n", gapEvents)
	fmt.Printf("   Snapshot Requests: %d\n", snapshotRequests)
	fmt.Printf("   Total Events: %d\n", gapEvents+snapshotRequests)
	if duration.Minutes() > 0 {
		fmt.Printf("   Events/min: %.1f\n", float64(gapEvents+snapshotRequests)/(duration.Minutes()))
	}

	fmt.Println("✅ Gap Detection Monitor stopped successfully")
}

// processGapDetectionEvent processes and displays gap detection events
func processGapDetectionEvent(payload string) {
	var event GapDetectionEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		log.Printf("❌ Error parsing gap detection event: %v", err)
		return
	}

	// Color-code based on action severity
	var icon string
	switch event.Action {
	case "CRITICAL_GAP":
		icon = "🚨"
	case "SNAPSHOT_REQUEST":
		icon = "📸"
	case "LOG_WARNING":
		icon = "⚠️"
	default:
		icon = "🔍"
	}

	fmt.Printf("%s GAP DETECTED: %s:%s\n", icon, event.Exchange, event.Symbol)
	fmt.Printf("   Expected: %d, Received: %d, Gap: %d\n",
		event.ExpectedSequence, event.ReceivedSequence, event.GapSize)
	fmt.Printf("   Action: %s, Time: %s\n",
		event.Action, event.Timestamp.Format("15:04:05.000"))
	fmt.Println()
}

// processSnapshotRequest processes and displays snapshot requests
func processSnapshotRequest(payload string) {
	var request SnapshotRequest
	if err := json.Unmarshal([]byte(payload), &request); err != nil {
		log.Printf("❌ Error parsing snapshot request: %v", err)
		return
	}

	// Color-code based on priority
	var icon string
	switch request.Priority {
	case "HIGH":
		icon = "🔴"
	case "MEDIUM":
		icon = "🟡"
	case "LOW":
		icon = "🟢"
	default:
		icon = "📸"
	}

	fmt.Printf("%s SNAPSHOT REQUESTED: %s:%s\n", icon, request.Exchange, request.Symbol)
	fmt.Printf("   Reason: %s\n", request.Reason)
	fmt.Printf("   Priority: %s, Time: %s\n",
		request.Priority, request.Timestamp.Format("15:04:05.000"))
	fmt.Println()
}
