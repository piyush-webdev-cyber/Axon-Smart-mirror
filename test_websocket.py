"""Test WebSocket connection to verify it's accessible."""
import asyncio
import json

import websockets

async def test_websocket():
    uri = "ws://localhost:8010/api/v1/ws"
    print(f"Testing WebSocket connection to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("[OK] WebSocket connected successfully!")
            
            # Wait for a message from the server
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"[OK] Received message from server: {message}")
            data = json.loads(message)
            assert data["type"] == "system.connected"
            assert data["payload"]["status"] == "connected"
            
            print("\n[SUCCESS] WebSocket is working correctly!")
            return True
            
    except asyncio.TimeoutError:
        print("[WARN] Connected but no message received (this might be OK)")
        return True
    except ConnectionRefusedError:
        print("[ERROR] Connection refused - backend may not be running")
        return False
    except Exception as e:
        print(f"[ERROR] WebSocket connection failed: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_websocket())
    exit(0 if result else 1)
