// Quick Integration Test: Fast test to verify basic functionality
// Run: node tests/quick-integration-test.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

async function quickTest() {
  console.log('⚡ Quick Integration Test\n');

  const manager = new ProxyManager(proxiesList, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 30000,
      maxTimeout: 8000,
      changeProxyLoop: 2
    }
  });

  try {
    // Test 1: Simple GET request (fetch-like API)
    console.log('1️⃣ Testing simple GET request...');
    const response1 = await manager.request('https://api.ipify.org');
    if (response1.ok) {
      const ip = await response1.text();
      console.log(`   ✅ SUCCESS: Got IP ${ip.trim()}`);
    } else {
      throw new Error(`Request failed: ${response1.status}`);
    }

    // Test 2: POST request with JSON
    console.log('2️⃣ Testing POST with JSON...');
    const response2 = await manager.request('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    if (response2.ok) {
      console.log(`   ✅ SUCCESS: POST completed (${response2.status})`);
    } else {
      throw new Error(`POST failed: ${response2.status}`);
    }

    // Test 3: Check live proxies
    console.log('3️⃣ Checking proxy health...');
    const liveCount = manager.liveProxiesListSync.length;
    console.log(`   ✅ SUCCESS: ${liveCount} live proxies available`);

    console.log('\n🎉 All tests passed! ProxyManager is working correctly.');

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    manager.stop();
    process.exit(0);
  }
}

quickTest();
