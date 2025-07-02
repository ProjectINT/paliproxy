// Debug Example: Detailed logging for ProxyManager debugging
// Run: node tests/debug-example.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');
const fs = require('fs');
const path = require('path');

// Clear previous logs function
function clearLogs() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir);
    logFiles.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleared log file: ${file}`);
      }
    });
  }
}

// More verbose ProxyManager configuration for debugging
const manager = new ProxyManager(proxiesList, {
  config: {
    healthCheckUrl: 'https://api.ipify.org',
    healthCheckInterval: 60000, // Increase interval to avoid conflicts
    maxTimeout: 15000, // Increase timeout
    changeProxyLoop: 1 // Reduce loops for simpler debugging
  }
});

async function debugMain() {
  console.log('🔍 Debug: Starting detailed ProxyManager analysis...\n');

  // Clear previous logs
  clearLogs();

  const testUrls = [
    'https://api.ipify.org'
  ];

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const debugLogStream = fs.createWriteStream(path.join(logsDir, 'debug-example.log'), { flags: 'w' }); // 'w' for overwrite

  console.log(`🔍 Debug: Testing ${testUrls.length} URLs with ${proxiesList.length} proxies`);
  debugLogStream.write(`=== DEBUG Test run at ${new Date().toISOString()} ===\n`);

  // Test each URL with detailed timing
  for (const url of testUrls) {
    console.log(`🔍 Debug: Testing URL: ${url}`);
    debugLogStream.write(`[DEBUG] Testing URL: ${url}\n`);

    const startTime = Date.now();

    try {
      console.log(`⏱️  Starting request at: ${new Date().toISOString()}`);
      debugLogStream.write(`[DEBUG] Request started at: ${new Date().toISOString()}\n`);

      const response = await manager.request({ url, method: 'GET' });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️  Request completed in: ${duration}ms`);
      debugLogStream.write(`[DEBUG] Request completed in: ${duration}ms\n`);

      if (response && typeof response.text === 'function') {
        const text = await response.text();
        const msg = `✅ [${url}] Status: ${response.status}, IP: ${text.trim()}, Duration: ${duration}ms`;
        console.log(msg);
        debugLogStream.write(msg + '\n');
      } else {
        const msg = `❌ [${url}] Unexpected response format, Duration: ${duration}ms`;
        console.log(msg);
        debugLogStream.write(msg + '\n');
      }
    } catch (e) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errMsg = `❌ [${url}] Error: ${e.message}, Duration: ${duration}ms`;
      console.error(errMsg);
      debugLogStream.write(errMsg + '\n');
      debugLogStream.write(`[DEBUG] Error stack: ${e.stack}\n`);
    }

    // Add delay between requests to avoid conflicts
    console.log('⏸️  Waiting 2 seconds before next request...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  debugLogStream.end();
  console.log('\n🔍 Debug: All tests completed! Check logs/debug-example.log for detailed results.');

  // Give some time for any background processes to finish
  setTimeout(() => {
    console.log('🛑 Debug: Stopping ProxyManager...');
    manager.stop();
    setTimeout(() => process.exit(0), 1000);
  }, 3000);
}

debugMain().catch((error) => {
  console.error('🚨 Debug: Fatal error:', error);
  process.exit(1);
});
