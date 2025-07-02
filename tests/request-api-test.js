// Request API Test: Test that request method works like fetch API
// Run: node tests/request-api-test.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

// ProxyManager configuration for testing
const manager = new ProxyManager(proxiesList, {
  config: {
    healthCheckUrl: 'https://api.ipify.org',
    healthCheckInterval: 30000,
    maxTimeout: 10000,
    changeProxyLoop: 2
  }
});

async function testFetchLikeAPI() {
  console.log('🧪 Testing fetch-like API signature...\n');

  const tests = [
    {
      name: 'GET request with URL only',
      test: async () => {
        const response = await manager.request('https://api.ipify.org');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.text();
        console.log(`   ✅ Response: ${data.slice(0, 50)}...`);
      }
    },
    {
      name: 'GET request with URL and options',
      test: async () => {
        const response = await manager.request('https://ifconfig.me/ip', {
          method: 'GET',
          headers: {
            'User-Agent': 'ProxyManager-Test/1.0'
          }
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.text();
        console.log(`   ✅ Response: ${data.slice(0, 50)}...`);
      }
    },
    {
      name: 'POST request with body',
      test: async () => {
        const response = await manager.request('https://httpbin.org/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: 'data' })
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.text();
        console.log(`   ✅ POST response received (length: ${data.length})`);
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔍 ${test.name}`);
      await test.test();
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All fetch-like API tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Testing ProxyManager fetch-like API...\n');

  try {
    await testFetchLikeAPI();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Stopping tests...');
  manager.stop();
  process.exit(0);
});

main().catch(console.error);
