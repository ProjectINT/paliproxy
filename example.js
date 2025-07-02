// Example: Test real proxies from proxies-list.js using ProxyManager
// Run: node example.js

const { ProxyManager } = require('./dist');
const { proxiesList } = require('./proxies-list');

// ProxyManager configuration for testing
const manager = new ProxyManager(proxiesList, {
  config: {
    healthCheckUrl: 'https://api.ipify.org',
    healthCheckInterval: 30000,
    maxTimeout: 10000,
    changeProxyLoop: 2
  }
});

async function main() {
  console.log('🚀 Testing ProxyManager with real proxies...\n');

  const testUrls = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://ipinfo.io/ip'
  ];

  const fs = require('fs');
  const path = require('path');

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logStream = fs.createWriteStream(path.join(logsDir, 'example.log'), { flags: 'a' });

  console.log(`📋 Testing ${testUrls.length} URLs with ${proxiesList.length} proxies`);
  logStream.write(`\n=== Test run at ${new Date().toISOString()} ===\n`);

  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    try {
      const response = await manager.request({ url, method: 'GET' });
      if (response && typeof response.text === 'function') {
        const text = await response.text();
        const msg = `✅ [${url}] Status: ${response.status}, IP: ${text.trim()}`;
        console.log(msg);
        logStream.write(msg + '\n');
      } else {
        const msg = `❌ [${url}] Unexpected response format`;
        console.log(msg);
        logStream.write(msg + '\n');
      }
    } catch (e) {
      const errMsg = `❌ [${url}] Error: ${e.message}`;
      console.error(errMsg);
      logStream.write(errMsg + '\n');
    }
  }
  logStream.end();
  console.log('\n✨ All tests completed! Check example.log for detailed results.');

  // Gracefully terminate process to avoid hanging connections
  setTimeout(() => process.exit(0), 100);
}

main().catch(console.error);
