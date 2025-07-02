// Example: Test real proxies from proxies-list.ts using ProxyManager
// Run: node example.js


const { ProxyManager } = require('./dist'); // or './src' if not built
const { proxiesList } = require('./proxies-list');

// ProxyManager expects config, minimal for test:
const manager = new ProxyManager(proxiesList, {
  config: {
    healthCheckUrl: 'https://api.ipify.org',
    healthCheckInterval: 30000,
    maxTimeout: 10000,
    changeProxyLoop: 2
  }
});

async function main() {
  const testUrls = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://ipinfo.io/ip'
  ];

  const fs = require('fs');
  const logStream = fs.createWriteStream('example.log', { flags: 'a' });

  for (const url of testUrls) {
    console.log(`[LOG] Запрос: ${url}`);
    try {
      const response = await manager.request({ url, method: 'GET' });
      if (response && typeof response.text === 'function') {
        const text = await response.text();
        const msg = `[${url}] Status: ${response.status}, IP: ${text.trim()}`;
        console.log(msg);
        logStream.write(msg + '\n');
      } else {
        const msg = `[${url}] Unexpected response: ` + JSON.stringify(response);
        console.log(msg);
        logStream.write(msg + '\n');
      }
    } catch (e) {
      const errMsg = `[${url}] Error: ${e.message}`;
      console.error(errMsg);
      logStream.write(errMsg + '\n');
    }
  }
  logStream.end();
  // Явно завершаем процесс, чтобы не было зависания из-за открытых сокетов/таймеров
  setTimeout(() => process.exit(0), 100);
}

main().catch(console.error);
