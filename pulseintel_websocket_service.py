import asyncio
import json
import time
import websockets
from collections import defaultdict

# --- Configuration ---
GO_STREAM_URL = "ws://localhost:8899/ws"
FRONTEND_HOST = "0.0.0.0"
FRONTEND_PORT = 8000

# --- State Management ---
# This will store the connected frontend clients for each channel
# e.g., {"orderbook:BTCUSDT": {client1, client2}, "trade:ETHUSDT": {client3}}
subscriptions = defaultdict(set)

# This will store which channels each client is subscribed to
# e.g., {client1: {"orderbook:BTCUSDT", "trade:ETHUSDT"}}
client_subscriptions = defaultdict(set)

# --- Statistics Tracking ---
message_stats = defaultdict(int)
last_stats_time = time.time()

# --- Calculation State ---
# Stores data for VWAP and CVD calculations
# e.g., {"BTCUSDT": {"cumulative_volume": 1000, "cumulative_tpv": 60000000, "cvd": 50}}
vwap_cvd_state = defaultdict(lambda: {
    "cumulative_volume": 0,
    "cumulative_tpv": 0, # Sum of (Typical Price * Volume)
    "cvd": 0
})



async def handle_frontend_client(websocket):
    """
    Manages a single frontend client connection, handling subscriptions and unsubscriptions.
    """
    try:
        print(f"✅ Frontend client connected: {websocket.remote_address}")
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                channel = data.get("channel")

                if not action or not channel:
                    await websocket.send(json.dumps({"error": "Invalid message format"}))
                    continue

                if action == "subscribe":
                    subscriptions[channel].add(websocket)
                    client_subscriptions[websocket].add(channel)
                    total_subs = len(client_subscriptions[websocket])
                    print(f"📈 Client subscribed to {channel} (total: {total_subs} channels)")
                    await websocket.send(json.dumps({"status": "success", "message": f"Subscribed to {channel}"}))

                elif action == "unsubscribe":
                    if websocket in subscriptions.get(channel, set()):
                        subscriptions[channel].remove(websocket)
                    if channel in client_subscriptions.get(websocket, set()):
                        client_subscriptions[websocket].remove(channel)
                    total_subs = len(client_subscriptions[websocket])
                    print(f"📉 Client unsubscribed from {channel} (remaining: {total_subs} channels)")
                    await websocket.send(json.dumps({"status": "success", "message": f"Unsubscribed from {channel}"}))

            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid JSON"}))
            except Exception as e:
                print(f"Error handling frontend message: {e}")

    except websockets.exceptions.InvalidUpgrade:
        print(f"⚠️ Received a non-WebSocket request from {websocket.remote_address}. This is expected during development and can be ignored.")
    finally:
        # Clean up all subscriptions for this client when it disconnects
        for channel in client_subscriptions.get(websocket, set()):
            if websocket in subscriptions.get(channel, set()):
                subscriptions[channel].remove(websocket)
        if websocket in client_subscriptions:
            del client_subscriptions[websocket]
        print(f"❌ Frontend client disconnected: {websocket.remote_address}")


async def broadcast_to_subscribers(data):
    """
    Broadcasts incoming data from the Go stream to all subscribed frontend clients.
    Also calculates and broadcasts VWAP and CVD.
    """
    msg_type = data.get("type")
    symbol = data.get("symbol")
    
    if not msg_type or not symbol:
        return

    # Track message statistics
    global message_stats, last_stats_time
    message_stats[f"{msg_type}:{symbol}"] += 1
    
    # Broadcast the raw message
    raw_channel = f"{msg_type}:{symbol}"
    raw_clients = subscriptions.get(raw_channel, set())
    if raw_clients:
        message_to_send = json.dumps(data)
        await asyncio.gather(*[client.send(message_to_send) for client in raw_clients])

    # If it's a trade, update and broadcast VWAP and CVD
    if msg_type == "trade":
        try:
            price = float(data.get("price"))
            volume = float(data.get("quantity"))
            side = data.get("side")
            high = float(data.get("high", price))
            low = float(data.get("low", price))

            # Update state
            state = vwap_cvd_state[symbol]
            typical_price = (high + low + price) / 3
            state["cumulative_tpv"] += typical_price * volume
            state["cumulative_volume"] += volume
            if side == "buy":
                state["cvd"] += volume
            else:
                state["cvd"] -= volume

            # Calculate VWAP
            vwap = state["cumulative_tpv"] / state["cumulative_volume"] if state["cumulative_volume"] else 0

            # Broadcast VWAP
            vwap_channel = f"vwap:{symbol}"
            vwap_clients = subscriptions.get(vwap_channel, set())
            if vwap_clients:
                vwap_message = json.dumps({"type": "vwap", "symbol": symbol, "vwap": vwap, "timestamp": data.get("timestamp")})
                # Only log VWAP updates every 10th calculation
                if int(vwap * 100) % 10 == 0:
                    print(f"📊 VWAP update for {symbol}: ${vwap:.2f} → {len(vwap_clients)} clients")
                await asyncio.gather(*[client.send(vwap_message) for client in vwap_clients])

            # Broadcast CVD
            cvd_channel = f"cvd:{symbol}"
            cvd_clients = subscriptions.get(cvd_channel, set())
            if cvd_clients:
                cvd_message = json.dumps({"type": "cvd", "symbol": symbol, "cvd": state["cvd"], "timestamp": data.get("timestamp")})
                # Only log significant CVD changes
                if abs(state["cvd"]) % 100 < 10:  # Log when CVD crosses 100-unit boundaries
                    print(f"📈 CVD update for {symbol}: {state['cvd']:.2f} → {len(cvd_clients)} clients")
                await asyncio.gather(*[client.send(cvd_message) for client in cvd_clients])

        except (ValueError, TypeError) as e:
            print(f"Could not process trade for VWAP/CVD calculation: {e} - Data: {data}")



async def connect_to_go_stream():
    """
    Connects to the Go stream, receives messages, and routes them for broadcasting.
    """
    while True:
        try:
            async with websockets.connect(GO_STREAM_URL) as websocket:
                print("✅ Successfully connected to Go Stream")
                async for message in websocket:
                    try:
                        # The library handles decompression automatically
                        data = json.loads(message)
                        
                        # If the message is a batch, process each item
                        if data.get("type") == "batch" and "batch" in data:
                            for item in data["batch"]:
                                await broadcast_to_subscribers(item)
                        else:
                            # Handle single messages if they are not batched
                            await broadcast_to_subscribers(data)

                    except json.JSONDecodeError:
                        print("⚠️ Could not decode JSON from Go Stream")
                    except Exception as e:
                        print(f"Error processing message from Go Stream: {e}")

        except (websockets.exceptions.ConnectionClosedError, ConnectionRefusedError) as e:
            print(f"❌ Connection to Go Stream failed: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"An unexpected error occurred with the Go Stream connection: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)


async def periodic_broadcast():
    """
    Periodically broadcasts the latest calculated data (VWAP, CVD) to subscribers.
    Also prints statistics summary every 30 seconds.
    """
    global message_stats, last_stats_time
    
    while True:
        await asyncio.sleep(1) # Broadcast every second
        
        # Print statistics every 30 seconds
        current_time = time.time()
        if current_time - last_stats_time >= 30:
            total_messages = sum(message_stats.values())
            active_channels = len([ch for ch, clients in subscriptions.items() if clients])
            total_clients = sum(len(clients) for clients in subscriptions.values())
            
            print(f"\n📊 === WebSocket Service Stats (30s) ===")
            print(f"🔗 Active Channels: {active_channels}")
            print(f"👥 Total Client Connections: {total_clients}")
            print(f"📨 Messages Processed: {total_messages}")
            print(f"⚡ Rate: {total_messages/30:.1f} msg/sec")
            
            if message_stats:
                print("📈 Top Channels:")
                sorted_stats = sorted(message_stats.items(), key=lambda x: x[1], reverse=True)[:5]
                for channel, count in sorted_stats:
                    print(f"   {channel}: {count} messages")
            
            print("=" * 45)
            
            # Reset stats
            message_stats.clear()
            last_stats_time = current_time
        
        # Broadcast periodic VWAP/CVD updates (reduced frequency)
        for symbol, state in vwap_cvd_state.items():
            if state["cumulative_volume"] > 0:
                vwap = state["cumulative_tpv"] / state["cumulative_volume"]
                
                # Broadcast VWAP (every 5 seconds)
                if int(current_time) % 5 == 0:
                    vwap_channel = f"vwap:{symbol}"
                    vwap_clients = subscriptions.get(vwap_channel, set())
                    if vwap_clients:
                        vwap_message = json.dumps({"type": "vwap", "symbol": symbol, "vwap": vwap, "timestamp": time.time()})
                        await asyncio.gather(*[client.send(vwap_message) for client in vwap_clients])

                # Broadcast CVD (every 5 seconds)
                if int(current_time) % 5 == 0:
                    cvd_channel = f"cvd:{symbol}"
                    cvd_clients = subscriptions.get(cvd_channel, set())
                    if cvd_clients:
                        cvd_message = json.dumps({"type": "cvd", "symbol": symbol, "cvd": state["cvd"], "timestamp": time.time()})
                        await asyncio.gather(*[client.send(cvd_message) for client in cvd_clients])


async def main():
    """
    Starts the frontend WebSocket server and the Go stream client.
    """
    print("--- PulseIntel WebSocket Service ---")
    
    # Start the client to connect to the Go stream and the periodic broadcaster as background tasks
    go_stream_task = asyncio.create_task(connect_to_go_stream())
    periodic_broadcast_task = asyncio.create_task(periodic_broadcast())

    # Use 'async with' which is the standard and more robust way to run the server
    async with websockets.serve(handle_frontend_client, FRONTEND_HOST, FRONTEND_PORT):
        print(f"🚀 Listening for frontend connections on ws://{FRONTEND_HOST}:{FRONTEND_PORT}")
        # The server will run until the background tasks complete or are cancelled.
        await asyncio.gather(go_stream_task, periodic_broadcast_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("--- Shutting down WebSocket service. ---")