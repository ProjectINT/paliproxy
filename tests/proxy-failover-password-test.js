// Proxy Failover Test v2: Test with broken password
// Run: node tests/proxy-failover-password-test.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

async function testProxyFailoverWithBadPassword() {
  console.log('🧪 Testing proxy failover with broken password...\n');

  // Create a copy of proxies and intentionally break the first one's password
  const proxiesWithBadFirst = [...proxiesList];
  const originalFirst = { ...proxiesWithBadFirst[0] };

  // Break the first proxy by changing the password
  proxiesWithBadFirst[0] = {
    ...originalFirst,
    pass: 'WRONG_PASSWORD_123'
  };

  console.log('📋 Proxy setup:');
  console.log(`   Original first proxy: ${originalFirst.ip}:${originalFirst.port} ✅`);
  console.log(`   Modified first proxy: ${proxiesWithBadFirst[0].ip}:${proxiesWithBadFirst[0].port} ❌ (wrong password)`);
  console.log(`   Total proxies in list: ${proxiesWithBadFirst.length}`);
  console.log();

  const manager = new ProxyManager(proxiesWithBadFirst, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 30000,
      maxTimeout: 5000, // Shorter timeout for faster test
      changeProxyLoop: 3
    }
  });

  // Wait for health checks to complete
  console.log('⏳ Waiting for health checks to complete...');
  const liveProxies = await manager.getLiveProxiesList();
  console.log(`🔍 Live proxies count: ${liveProxies.length}`);

  liveProxies.forEach((proxy, index) => {
    const isWorking = proxy.pass !== 'WRONG_PASSWORD_123';
    const status = isWorking ? '✅' : '❌';
    console.log(`   Live proxy ${index + 1}: ${proxy.ip}:${proxy.port} ${status}`);
  });

  // Test that requests work despite broken first proxy
  const tests = [
    {
      name: 'Single request should work with failover',
      test: async () => {
        const response = await manager.request('https://api.ipify.org');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const ip = await response.text();
        console.log(`   ✅ Got response from IP: ${ip.trim()}`);
      }
    },
    {
      name: 'Multiple concurrent requests should work',
      test: async () => {
        const promises = [
          manager.request('https://ifconfig.me/ip'),
          manager.request('https://ipinfo.io/ip'),
          manager.request('https://api.ipify.org')
        ];

        const responses = await Promise.all(promises);
        const ips = await Promise.all(responses.map(r => r.text()));

        console.log(`   ✅ All ${ips.length} requests completed successfully`);
        ips.forEach((ip, index) => {
          console.log(`     Request ${index + 1}: ${ip.trim()}`);
        });
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}`);
      await test.test();
      passed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All failover tests passed!');
    console.log('✅ ProxyManager correctly handles authentication failures');
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }

  manager.stop();
}

async function main() {
  console.log('🚀 Testing ProxyManager failover with bad password...\n');

  try {
    await testProxyFailoverWithBadPassword();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Stopping tests...');
  process.exit(0);
});

main().catch(console.error);
