"""Quick test script to verify backend endpoints are accessible."""
import httpx
import json

BASE_URL = "http://localhost:8000"

print("Testing Axon Backend Endpoints...\n")

# Test 1: Root
print("1. Testing root endpoint...")
try:
    response = httpx.get(f"{BASE_URL}/", timeout=5.0)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}\n")
except Exception as e:
    print(f"   ERROR: {e}\n")

# Test 2: API Docs
print("2. Testing API docs...")
try:
    response = httpx.get(f"{BASE_URL}/docs", timeout=5.0)
    print(f"   Status: {response.status_code}")
    print(f"   Docs accessible: {'Yes' if response.status_code == 200 else 'No'}\n")
except Exception as e:
    print(f"   ERROR: {e}\n")

# Test 3: Health endpoint
print("3. Testing health endpoint...")
try:
    response = httpx.get(f"{BASE_URL}/api/v1/health", timeout=5.0)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}\n")
except Exception as e:
    print(f"   ERROR: {e}\n")

# Test 4: System endpoint
print("4. Testing system endpoint...")
try:
    response = httpx.get(f"{BASE_URL}/api/v1/system", timeout=5.0)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}\n")
except Exception as e:
    print(f"   ERROR: {e}\n")

print("✅ All tests complete!")
print("\nNow test the frontend:")
print(f"   1. Open http://localhost:5173 in your browser")
print(f"   2. Check the browser console (F12) for WebSocket connection status")
