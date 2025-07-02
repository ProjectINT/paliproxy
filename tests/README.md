# Tests

Test folder for ProxyManager. All tests automatically clean previous logs before running.

## 🚀 Quick Start

```bash
# Run ALL tests (recommended way)
npm test
```

This command will run the master script `run-all-tests.js`, which:
- ✅ Checks environment variables
- 🧹 Cleans previous logs
- 🔄 Sequentially runs all tests
- 📊 Outputs detailed results report

## ⚙️ Prerequisites

**Required** before running tests:

### 1. Create `.env` file in project root:
```env
# Environment Configuration
NODE_ENV=development
TIMEOUT=5000
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_URL=https://httpbin.org/ip

CHAT_GPT_API_KEY="your_chat_gpt_api_key_here"
```

### 2. Create `proxies-list.js` file with working proxies:
```javascript
module.exports = [
  { ip: '1.2.3.4', port: 1080, user: 'username', pass: 'password' },
  { ip: '5.6.7.8', port: 1080, user: 'username', pass: 'password' },
  // add your working proxies
];
```

## 📋 Test List

The master script runs the following tests:

### 1. 🚀 Basic Proxy Test (`proxy-basic-test.js`)
**Main ProxyManager functionality test**
- Works with real proxies from `proxies-list.js`
- Requests to multiple URLs for IP checking
- Standard ProxyManager configuration
- Basic logging

### 2. 🔍 Debug Proxy Test (`proxy-debug-test.js`)
**Detailed debug test with extended logging**
- Detailed logging with timestamps
- Single URL for simplified debugging
- Extended timeouts for analysis
- Detailed error tracing

### 3. 🔄 Failover Test (`proxy-failover-test.js`)
**Test switching between proxies on failures**

### 4. 🔐 Failover Test with Password (`proxy-failover-password-test.js`)
**Test proxy switching with authentication**

### 5. 💓 Proxy Health Check (`health-check-test.js`)
**Test proxy health monitoring system**

### 6. 🌐 API Requests Test (`request-api-test.js`)
**Test fetch-like API for requests**

### 7. ⚡ Quick Integration Test (`quick-integration-test.js`)
**Quick check of main components**

### 8. 📦 Package Test (`test-package.js`)
**Test installed npm package**

### 9. 🎵 TTS ReadableStream Test (`tts-readablestream-test.js`)
**Test streaming data through proxy**

## 🎯 Individual Test Execution

If you need to run a specific test:

```bash
# Main functionality test
node tests/proxy-basic-test.js

# Detailed debugging
node tests/proxy-debug-test.js

# Failover test
node tests/proxy-failover-test.js

# Proxy health check
node tests/health-check-test.js

# API request test
node tests/request-api-test.js

# And other tests...
```

## 📊 Test Results

After running `npm test` you will get:

```
═══════════════════════════════════════════════════════════
🚀 RUNNING ALL PROXY-CONNECTION TESTS
═══════════════════════════════════════════════════════════

🔍 Checking environment variables...
✅ Preliminary check completed

🧹 Cleaning previous logs...

📋 Basic Proxy Test
   Main ProxyManager functionality test
🔧 Running: proxy-basic-test.js
✅ Test completed successfully (1250ms)

...

═══════════════════════════════════════════════════════════
📊 TEST RESULTS REPORT
═══════════════════════════════════════════════════════════

✅ Successful: 8
❌ Failed: 1
⏱️  Total time: 15420ms

📋 Detailed results:
   ✅ SUCCESS Basic Proxy Test (1250ms)
   ✅ SUCCESS Debug Proxy Test (2100ms)
   ...

📂 Logs saved to logs/ folder
```

## 🚀 Quick Launch

```bash
# All tests with one command (recommended)
npm test
```

---

## Features

### 🗑️ Automatic Log Cleanup
All tests automatically clean previous `.log` files in the `logs/` folder before running to avoid confusion during debugging.

### 📁 Log Structure
```
logs/
├── proxy-basic-test.log    # Main test results
├── proxy-debug-test.log    # Detailed debug logs
└── app.log                 # ProxyManager system logs (automatic)
```

### ⚙️ ProxyManager Configuration

**Main parameters:**
- `healthCheckUrl` - URL for proxy health checking
- `healthCheckInterval` - Proxy check interval (ms)
- `maxTimeout` - Maximum request timeout (ms)
- `changeProxyLoop` - Number of proxy change cycles on failure

### 🎯 Testing Goals

1. **Functionality** - checking basic proxy operations
2. **Stability** - testing error handling
3. **Performance** - measuring response time
4. **Logging** - checking log correctness

### 📝 Result Interpretation

**Successful test:**
```
✅ [URL] Status: 200, IP: xxx.xxx.xxx.xxx
```

**Error:**
```
❌ [URL] Error: error description
```

**Additionally in debug mode:**
- Start/completion timestamps
- Request duration in milliseconds
- Detailed error stack

### 🔧 Problem Debugging

1. **First run** `proxy-debug-test.js` for detailed analysis
2. **Check logs** in `logs/proxy-debug-test.log`
3. **Analyze** system logs in `logs/app.log`
4. **If needed** change test configuration

### 🚦 Test Statuses

- **✅ Success** - proxy works, correct response received
- **❌ Error** - proxy or network problems
- **⏱️ Timeout** - timeout exceeded
- **🔄 Retry** - attempt to use another proxy
