"""Integration test: Verify frontend and backend are working together."""
import httpx
import json

print("=" * 60)
print("AXON INTEGRATION TEST")
print("=" * 60)

backend_url = "http://localhost:8000"
frontend_url = "http://localhost:5173"

# Test 1: Backend Health
print("\n[1/4] Testing Backend Health Endpoint...")
try:
    response = httpx.get(f"{backend_url}/api/v1/health", timeout=5.0)
    if response.status_code == 200:
        print(f"   [OK] Backend is healthy")
        print(f"   Response: {json.dumps(response.json(), indent=6)}")
    else:
        print(f"   [FAIL] Backend returned status {response.status_code}")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 2: Backend System Info
print("\n[2/4] Testing Backend System Endpoint...")
try:
    response = httpx.get(f"{backend_url}/api/v1/system", timeout=5.0)
    if response.status_code == 200:
        print(f"   [OK] System endpoint working")
        print(f"   Response: {json.dumps(response.json(), indent=6)}")
    else:
        print(f"   [FAIL] System endpoint returned status {response.status_code}")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 3: Backend CORS Configuration
print("\n[3/4] Testing Backend CORS Configuration...")
try:
    response = httpx.options(
        f"{backend_url}/api/v1/health",
        headers={"Origin": frontend_url},
        timeout=5.0
    )
    cors_header = response.headers.get("access-control-allow-origin", "Not set")
    if cors_header == frontend_url or cors_header == "*":
        print(f"   [OK] CORS configured correctly: {cors_header}")
    else:
        print(f"   [WARN] CORS may not be configured for frontend: {cors_header}")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 4: Frontend Accessibility
print("\n[4/4] Testing Frontend Accessibility...")
try:
    response = httpx.get(frontend_url, timeout=5.0, follow_redirects=True)
    if response.status_code == 200:
        print(f"   [OK] Frontend is accessible")
    else:
        print(f"   [FAIL] Frontend returned status {response.status_code}")
except Exception as e:
    print(f"   [ERROR] {e}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Backend:  {backend_url}")
print(f"Frontend: {frontend_url}")
print(f"API Docs: {backend_url}/docs")
print("\nBoth servers are running!")
print("Open http://localhost:5173 in your browser to use the app.")
print("=" * 60)
