// Test external usage example - this simulates how the package would be used externally
import { ProxyManager } from './dist/src/index.js';
import type { ProxyBase, ProxyManagerOptions, RequestConfig, ProxyConfig } from './dist/src/index.js';

// Example usage showing that all types are now properly available
const proxies: ProxyBase[] = [
  {
    ip: '127.0.0.1',
    port: 1080,
    user: 'username',
    pass: 'password'
  }
];

const options: ProxyManagerOptions = {
  disableLogging: false,
  config: {
    onErrorRetries: 3,
    onTimeoutRetries: 2,
    maxTimeout: 10000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckInterval: 60000,
    changeProxyLoop: 5
  }
};

const requestConfig: RequestConfig = {
  method: 'GET',
  headers: {
    'User-Agent': 'My App 1.0'
  }
};

// All types should be fully available and resolvable
const manager = new ProxyManager(proxies, options);

async function testTypes() {
  try {
    const response = await manager.request('https://httpbin.org/ip', requestConfig);
    const liveProxies: ProxyConfig[] = await manager.getLiveProxiesList();

    console.log('Response:', response);
    console.log('Live proxies:', liveProxies);
  } catch (error) {
    console.error('Error:', error);
  }
}

// This is just a type test file - not meant to be run
export { testTypes };
