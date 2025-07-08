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

### OpenAI SDK Integration

ProxyManager can be used as a drop-in replacement for fetch in OpenAI SDK. The manager automatically handles Headers conversion and maintains full fetch API compatibility:

```typescript
import OpenAI from 'openai';
import { ProxyManager } from 'proxy-connection';

const manager = new ProxyManager(proxies, {
  config: {
    healthCheckUrl: 'https://httpbin.org/ip',
    maxTimeout: 30000, // OpenAI requests can take longer
    changeProxyLoop: 3,
  }
});

// Use ProxyManager as fetch replacement in OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: manager.request // No .bind() needed - auto-bound
});

// All OpenAI SDK methods now work through your proxy pool
const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello!" }],
});

const models = await openai.models.list();
const embeddings = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: "Your text here",
});
```

#### Key Features for OpenAI Integration:

- **Automatic Headers Conversion**: ProxyManager automatically converts OpenAI SDK's Headers objects to plain objects
- **Full Fetch Compatibility**: Supports all fetch API features used by OpenAI SDK
- **Auto-bound Methods**: No need for `.bind(manager)` - the request method is automatically bound in constructor
- **Error Handling**: Proxy failures are handled transparently with automatic fallback to other proxies
- **Request Logging**: All OpenAI requests are logged (when logging is enabled) for debugging

#### Alternative Usage (with explicit binding):

If you prefer explicit binding or are using an older version:

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: manager.request.bind(manager) // Explicit binding
});
```

#### Configuration for OpenAI:

Recommended configuration for OpenAI API requests:

```typescript
const manager = new ProxyManager(proxies, {
  config: {
    maxTimeout: 60000,           // OpenAI requests can take up to 60 seconds
    healthCheckInterval: 120000, // Check proxies every 2 minutes
    changeProxyLoop: 2,          // Try each proxy twice before giving up
    onErrorRetries: 1,           // Retry once on network errors
    onTimeoutRetries: 0,         // Don't retry timeouts (switch proxy immediately)
  }
});
```

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

## Configuration

The ProxyManager accepts a configuration object with various options to control proxy behavior, health checks, retries, and timeouts.

### Complete Configuration Reference

```typescript
const manager = new ProxyManager(proxies, {
  config: {
    // Retry behavior
    onErrorRetries: 0,           // Number of retries on error before switching proxy (default: 0)
    onTimeoutRetries: 0,         // Number of retries on timeout before switching proxy (default: 0)
    
    // Timeouts
    maxTimeout: 5000,            // Maximum request timeout in milliseconds (default: 5000)
    
    // Health check settings
    healthCheckUrl: 'https://httpbin.org/ip',     // URL for proxy health checks (default: from env or 'https://httpbin.org/ip')
    healthCheckInterval: 60000,   // Health check interval in milliseconds (default: 60000)
    
    // Proxy switching behavior
    changeProxyLoop: 2,          // Number of proxy change loops - attempts per proxy (default: 2)
  },
  
  // Logger options
  sentryLogger: myLoggerInstance,  // Optional custom Sentry logger
  disableLogging: false,           // Set to true to disable all logging (default: false)
});
```

### Configuration Fields Explained

#### Retry Settings

- **`onErrorRetries`** (number, default: `0`)
  - Number of retry attempts when a request fails with an error
  - Set to `0` to immediately switch to next proxy on error
  - Higher values will retry the same proxy before switching

- **`onTimeoutRetries`** (number, default: `0`)
  - Number of retry attempts when a request times out
  - Set to `0` to immediately switch to next proxy on timeout
  - Higher values will retry the same proxy before switching

#### Timeout Settings

- **`maxTimeout`** (number, default: `5000`)
  - Maximum time in milliseconds to wait for a request to complete
  - Applies to all requests made through the proxy
  - Requests exceeding this timeout will be aborted

#### Health Check Settings

- **`healthCheckUrl`** (string, default: `process.env.HEALTH_CHECK_URL` or `'https://httpbin.org/ip'`)
  - URL used to test proxy availability and latency
  - Should be a reliable endpoint that responds quickly
  - Used for automatic proxy health monitoring

- **`healthCheckInterval`** (number, default: `60000`)
  - Interval in milliseconds between automatic health checks
  - Set to `0` to disable automatic health checks
  - Lower values provide more up-to-date proxy status but increase network overhead

#### Proxy Management

- **`changeProxyLoop`** (number, default: `2`)
  - Number of cicles of proxies before throw error
  - If set to `2`, each proxy will be tried 2 times before error will be thrown
  - Affects the total number of attempts: `proxies.length × changeProxyLoop`

### Environment Variables

You can also configure some settings via environment variables:

```bash
# .env file
HEALTH_CHECK_URL=https://httpbin.org/ip
HEALTH_CHECK_INTERVAL=60000
TIMEOUT=5000
```

### Configuration Examples

#### High Availability Setup
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    onErrorRetries: 2,           // Retry failed requests 2 times
    onTimeoutRetries: 1,         // Retry timeouts once
    maxTimeout: 10000,           // 10 second timeout
    healthCheckInterval: 30000,  // Check proxies every 30 seconds
    changeProxyLoop: 3,          // Try each proxy 3 times
  }
});
```

#### Fast Failover Setup
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    onErrorRetries: 0,           // No retries, fast switching
    onTimeoutRetries: 0,         // No timeout retries
    maxTimeout: 3000,            // Short timeout
    healthCheckInterval: 15000,  // Frequent health checks
    changeProxyLoop: 1,          // Single attempt per proxy
  }
});
```

#### Performance Optimized Setup
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    maxTimeout: 5000,
    healthCheckInterval: 120000, // Less frequent health checks
    changeProxyLoop: 2,
  },
  disableLogging: true,          // Disable logging for better performance
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
- 🔄 Failover test (automatically skipped if only 1 proxy available)
- 🔐 Failover test with authentication (automatically skipped if only 1 proxy available)
- 💓 Proxy health check
- 🌐 API requests test
- ⚡ Quick integration test
- 📦 Package test
- 🎵 TTS ReadableStream test

**Note about Failover Tests:**
The failover tests require at least 2 proxies to test proxy switching functionality. If your `proxies-list.js` contains only 1 proxy, these tests will be automatically skipped with a clear message. This is expected behavior and not an error.

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

