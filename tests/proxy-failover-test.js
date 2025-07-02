// Proxy Failover Test: Test that ProxyManager switches to working proxy when first one fails
// Run: node tests/proxy-failover-test.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

async function testProxyFailover() {
  console.log('🧪 Testing proxy failover mechanism...\n');

  // Create a copy of proxies and intentionally break the first one
  const proxiesWithBadFirst = [...proxiesList];
  const originalFirst = { ...proxiesWithBadFirst[0] };

  // Break the first proxy by changing the IP (add .255 to make it invalid)
  proxiesWithBadFirst[0] = {
    ...originalFirst,
    ip: originalFirst.ip.replace(/\.\d+$/, '.255') // Change last octet to 255 (likely invalid)
  };

  console.log('📋 Proxy setup:');
  console.log(`   Original first proxy: ${originalFirst.ip}:${originalFirst.port} ✅`);
  console.log(`   Modified first proxy: ${proxiesWithBadFirst[0].ip}:${proxiesWithBadFirst[0].port} ❌ (broken)`);
  console.log(`   Total proxies in list: ${proxiesWithBadFirst.length}`);
  console.log();

  const manager = new ProxyManager(proxiesWithBadFirst, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 30000,
      maxTimeout: 10000,
      changeProxyLoop: 2
    }  });

  console.log('📋 Initial proxy list:');
  proxiesWithBadFirst.forEach((proxy, index) => {
    const status = index === 0 ? '❌ (broken - invalid IP)' : '✅ (working)';
    console.log(`   ${index + 1}. ${proxy.ip}:${proxy.port} ${status}`);
  });
  console.log();

  // Wait for health checks to complete and check live proxies
  console.log('⏳ Waiting for health checks to complete...');
  const liveProxies = await manager.getLiveProxiesList();
  console.log(`🔍 Live proxies count: ${liveProxies.length}`);

  const expectedLiveCount = proxiesWithBadFirst.length - 1; // All except the broken one
  if (liveProxies.length === expectedLiveCount) {
    console.log('✅ Broken proxy correctly filtered out from live proxies');
    liveProxies.forEach((proxy, index) => {
      console.log(`   Live proxy ${index + 1}: ${proxy.ip}:${proxy.port}`);
    });
  } else {
    console.log(`❌ Expected ${expectedLiveCount} live proxies, got: ${liveProxies.length}`);
    liveProxies.forEach((proxy, index) => {
      console.log(`   Live proxy ${index + 1}: ${proxy.ip}:${proxy.port}`);
    });
  }

  // Test that requests work despite broken first proxy
  const tests = [
    {
      name: 'GET request should use working proxy',
      test: async () => {
        const response = await manager.request('https://api.ipify.org');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }        const ip = await response.text();
        console.log(`   ✅ Got response from IP: ${ip.trim()}`);

        // Verify that we did NOT get response from the broken proxy
        const brokenProxyIP = proxiesWithBadFirst[0].ip;
        if (ip.trim() !== brokenProxyIP) {
          console.log(`   ✅ Confirmed: Request did NOT use broken proxy ${brokenProxyIP}`);
        } else {
          throw new Error(`Request unexpectedly used broken proxy ${brokenProxyIP}`);
        }
      }
    },
    {
      name: 'Multiple requests should consistently work',
      test: async () => {
        const promises = [
          manager.request('https://ifconfig.me/ip'),
          manager.request('https://ipinfo.io/ip'),
          manager.request('https://api.ipify.org')
        ];

        const responses = await Promise.all(promises);
        const ips = await Promise.all(responses.map(r => r.text()));

        console.log(`   ✅ All ${ips.length} requests completed successfully`);

        // Check if all responses came from the same working proxy
        const uniqueIPs = [...new Set(ips.map(ip => ip.trim()))];
        if (uniqueIPs.length === 1) {
          console.log(`   ✅ All requests consistently used IP: ${uniqueIPs[0]}`);
        } else {
          console.log(`   ℹ️ Requests used ${uniqueIPs.length} different IPs: ${uniqueIPs.join(', ')}`);
        }
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
    console.log('✅ ProxyManager correctly handles broken proxies');
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }

  manager.stop();
}

async function main() {
  console.log('🚀 Testing ProxyManager failover capabilities...\n');

  try {
    await testProxyFailover();
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
