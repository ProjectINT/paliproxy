// Test package functionality using compiled dist files
// This tests the actual npm package structure
// Run: node tests/test-package.js

const { ProxyManager } = require('../dist/src/index.js');
const { proxiesList } = require('../proxies-list.js');

async function testPackage() {
  console.log('📦 Testing npm package functionality...\n');

  console.log('🔧 Creating ProxyManager instance...');
  const manager = new ProxyManager(proxiesList, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 30000,
      maxTimeout: 8000,
      changeProxyLoop: 2
    }
  });

  try {
    console.log('1️⃣ Testing simple fetch-like API...');
    const response1 = await manager.request('https://api.ipify.org');
    if (response1.ok) {
      const ip = await response1.text();
      console.log(`   ✅ SUCCESS: Got IP ${ip.trim()}`);
    } else {
      throw new Error(`Request failed: ${response1.status}`);
    }

    console.log('2️⃣ Testing POST request...');
    const response2 = await manager.request('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'npm-package-test', timestamp: Date.now() })
    });
    if (response2.ok) {
      console.log(`   ✅ SUCCESS: POST completed (${response2.status})`);
    } else {
      throw new Error(`POST failed: ${response2.status}`);
    }

    console.log('3️⃣ Testing concurrent requests...');
    const promises = [
      manager.request('https://ifconfig.me/ip'),
      manager.request('https://ipinfo.io/ip')
    ];

    const responses = await Promise.all(promises);
    const ips = await Promise.all(responses.map(r => r.text()));
    console.log(`   ✅ SUCCESS: Got ${ips.length} responses`);
    ips.forEach((ip, i) => console.log(`     Response ${i + 1}: ${ip.trim()}`));

    console.log('\n🎉 Package test completed successfully!');
    console.log('✅ ProxyManager npm package is ready for publishing');

  } catch (error) {
    console.error(`❌ Package test failed: ${error.message}`);
    process.exit(1);
  } finally {
    manager.stop();
    process.exit(0);
  }
}

console.log('🚀 Starting ProxyManager Package Test\n');
testPackage();
