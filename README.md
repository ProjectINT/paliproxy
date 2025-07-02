
# proxy-connection

Module for managing a proxy pool with automatic health-check, balancing, logging, and Dante support.

## Architecture

- **ProxyManager** — the main class for working with a proxy pool. Supports automatic health checks, latency-based balancing, retries, request stack, and attempt history.
- **Dante** — integration with [Dante Socks5 Proxy](https://www.inet.no/dante/) for automatic management and configuration of socks5 proxies via scripts and configs (see the `dante/` folder).
- **Logger** — logging module with Sentry support and an extensible interface (see `src/utils/logger`). All errors and events are passed through the logger.
- **SnowflakeId** — unique ID generation for requests (see `src/utils/snowflakeId`).
- **Proxy testing** — async availability and latency check for each proxy (see `src/utils/testProxy`).
- **Balancing** — selects the next proxy by minimal latency and retry policy (see `src/utils/getNextProxy`).

## Usage

0. (optional) Run script to install proxy to your ubuntu mashine

```sh
ssh root@255.255.255.255 'bash -s' < ./dante/setup-dante.sh "your pass for proxy auth"
```

1. Install the package:

```sh
npm install proxy-connection
```

2. Example usage with new fetch-like API:

```typescript
import { ProxyManager } from 'proxy-connection';

const proxies = [
  { ip: '1.2.3.4', port: 1080, user: 'user', pass: 'pass' },
  // ...
];

const manager = new ProxyManager(proxies, {
  config: {
    healthCheckUrl: 'https://example.com/ping',
    healthCheckInterval: 30000,
    maxTimeout: 10000,
    changeProxyLoop: 2,
    // ...
  },
  sentryLogger: myLoggerInstance, // optional
  disableLogging: false, // optional - set to true to disable all logging
});

// New fetch-like API (recommended)
const response = await manager.request('https://api.ipify.org');
const ip = await response.text();

// With options (just like fetch)
const response = await manager.request('https://httpbin.org/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' })
});

if (response.ok) {
  const data = await response.json();
  console.log(data);
}
```

### Fetch API Compatibility

ProxyManager now supports fetch-like API for easy migration from `fetch()`:

```typescript
// Before (standard fetch)
const response = await fetch(url, options);

// After (with ProxyManager)
const response = await manager.request(url, options);
```

The response object supports the same methods as fetch:
- `response.text()` - get response as text
- `response.json()` - parse response as JSON
- `response.ok` - boolean indicating success (status 200-299)
- `response.status` - HTTP status code
- `response.statusText` - HTTP status message

## Dante

- The `dante/` folder contains scripts and instructions for automatic socks5 proxy setup via Dante.
- Use `setup-dante.sh` for quick installation and configuration.
- Proxies in the pool can be both external and local via Dante.

## Logger

- By default, a built-in logger with Sentry support is used.
- You can provide your own logger implementing the `ISentryLogger` interface.
- **Logging can be completely disabled** by setting `disableLogging: true` in options.
- All errors, attempts, and events are logged (when logging is enabled).

### Logger Configuration Examples

```typescript
// Default behavior - built-in logger with Sentry support
const manager = new ProxyManager(proxies);

// Use custom Sentry logger
const manager = new ProxyManager(proxies, {
  sentryLogger: myCustomSentryLogger
});

// Completely disable logging (no logs, no Sentry, best performance)
const manager = new ProxyManager(proxies, {
  disableLogging: true
});

// Disable logging with custom config
const manager = new ProxyManager(proxies, {
  disableLogging: true,
  config: {
    maxTimeout: 5000,
    healthCheckInterval: 60000,
    // ... other config options
  }
});
```

## Testing

### Prerequisites

**Required** before running tests:

1. **Environment variables** - create a `.env` file in the project root:
```env
# Environment Configuration
NODE_ENV=development
TIMEOUT=5000
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_URL=https://httpbin.org/ip

CHAT_GPT_API_KEY="your_chat_gpt_api_key_here"
```

2. **Working proxy list** - create a `proxies-list.js` file in the project root:
```javascript
module.exports = [
  { ip: '1.2.3.4', port: 1080, user: 'username', pass: 'password' },
  { ip: '5.6.7.8', port: 1080, user: 'username', pass: 'password' },
  // add your working proxies
];
```

### Running tests

```bash
# Run ALL tests (recommended way)
npm test
```

This command will sequentially run all available tests:
- ✅ Basic proxy test
- 🔍 Debug proxy test  
- 🔄 Failover test
- 🔐 Failover test with authentication
- 💓 Proxy health check
- 🌐 API requests test
- ⚡ Quick integration test
- 📦 Package test
- 🎵 TTS ReadableStream test

### Individual test execution

If you need to run a specific test:

```bash
# Basic functionality test
node tests/proxy-basic-test.js

# Detailed debugging with extended logging  
node tests/proxy-debug-test.js

# Failover test
node tests/proxy-failover-test.js

# And other tests...
```

**Test features:**
- 🧹 Automatic cleanup of previous logs
- 📊 Detailed results report
- ⏱️ Execution time measurement
- 📂 Logging to `logs/` folder
- 🎨 Colored console output

Detailed description of each test is available in `tests/README.md`.

## Unit tests

Unit test situated near test modules in src folder

