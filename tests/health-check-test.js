// Health Check Test: Test that health check correctly filters bad proxies
// Run: node tests/health-check-test.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

async function testHealthCheck() {
  console.log('🏥 Testing Health Check Functionality\n');

  // Create a mix of good and bad proxies
  const testProxies = [...proxiesList];

  // Add several intentionally broken proxies
  const badProxies = [
    {
      ip: '192.168.1.1', // Private IP - won't work
      port: 1080,
      user: 'test',
      pass: 'test'
    },
    {
      ip: '10.0.0.1', // Another private IP
      port: 1080,
      user: 'test',
      pass: 'test'
    },
    {
      ip: '127.0.0.1', // Localhost
      port: 9999,
      user: 'test',
      pass: 'test'
    },
    {
      ip: '203.0.113.1', // Test IP from RFC 5737 (reserved for documentation)
      port: 1080,
      user: 'test',
      pass: 'test'
    }
  ];

  const allProxies = [...testProxies, ...badProxies];

  console.log('📋 Proxy setup:');
  console.log(`   Good proxies: ${testProxies.length}`);
  console.log(`   Bad proxies: ${badProxies.length}`);
  console.log(`   Total proxies: ${allProxies.length}`);
  console.log();

  console.log('🔍 Bad proxies added:');
  badProxies.forEach((proxy, index) => {
    console.log(`   ${index + 1}. ${proxy.ip}:${proxy.port} (should be filtered out)`);
  });
  console.log();

  const manager = new ProxyManager(allProxies, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 60000, // Long interval to avoid interference
      maxTimeout: 5000, // Shorter timeout for faster detection
      changeProxyLoop: 2
    }
  });

  // Wait for initial health check to complete using new async method
  console.log('⏳ Waiting for initial health check to complete...');
  const liveProxies = await manager.getLiveProxiesList();

  console.log('\n📊 Health Check Results:');
  console.log(`   Total proxies tested: ${allProxies.length}`);
  console.log(`   Live proxies found: ${liveProxies.length}`);
  console.log(`   Expected live proxies: ${testProxies.length} (only good ones)`);

  console.log('\n🔍 Live proxies details:');
  liveProxies.forEach((proxy, index) => {
    const isOriginalGood = testProxies.some(p => p.ip === proxy.ip && p.port === proxy.port);
    const status = isOriginalGood ? '✅ (original good)' : '❌ (should be filtered)';
    console.log(`   ${index + 1}. ${proxy.ip}:${proxy.port} - latency: ${proxy.latency}ms ${status}`);
  });

  // Test that requests still work
  console.log('\n🧪 Testing request functionality:');
  try {
    const response = await manager.request('https://api.ipify.org');
    if (response.ok) {
      const ip = await response.text();
      console.log(`   ✅ Request successful, got IP: ${ip.trim()}`);

      // Check if the IP matches one of our live proxies
      const usedProxy = liveProxies.find(p => ip.trim().includes(p.ip) || p.ip.includes(ip.trim()));
      if (usedProxy) {
        console.log(`   ✅ Request used live proxy: ${usedProxy.ip}:${usedProxy.port}`);
      }
    } else {
      console.log(`   ❌ Request failed with status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }

  // Analysis
  console.log('\n📈 Analysis:');
  const expectedFilteredOut = badProxies.length;
  const actualFilteredOut = allProxies.length - liveProxies.length;

  if (actualFilteredOut >= expectedFilteredOut) {
    console.log(`   ✅ Health check working: ${actualFilteredOut} proxies filtered out`);
  } else {
    console.log(`   ⚠️  Health check might have issues: only ${actualFilteredOut} proxies filtered out, expected at least ${expectedFilteredOut}`);
  }

  // Check if all live proxies are from the original good list
  const allLiveAreGood = liveProxies.every(live =>
    testProxies.some(good => good.ip === live.ip && good.port === live.port)
  );

  if (allLiveAreGood) {
    console.log('   ✅ All live proxies are from the original good list');
  } else {
    console.log('   ⚠️  Some bad proxies made it to the live list');
  }

  manager.stop();

  console.log('\n🏁 Health check test completed!');
  process.exit(0);
}

async function main() {
  console.log('🚀 Starting Health Check Test...\n');

  try {
    await testHealthCheck();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Stopping health check test...');
  process.exit(0);
});

main().catch(console.error);
