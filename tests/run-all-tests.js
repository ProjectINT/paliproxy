#!/usr/bin/env node

/**
 * Master file for running all proxy-connection tests
 * Runs all tests sequentially and outputs a comprehensive report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// List of tests to run
const tests = [
  {
    name: 'Basic Proxy Test',
    file: 'proxy-basic-test.js',
    description: 'Main ProxyManager functionality test'
  },
  {
    name: 'Debug Proxy Test',
    file: 'proxy-debug-test.js',
    description: 'Detailed debug test with extended logging'
  },
  {
    name: 'Failover Test',
    file: 'proxy-failover-test.js',
    description: 'Test switching between proxies on failures'
  },
  {
    name: 'Failover Test with Password',
    file: 'proxy-failover-password-test.js',
    description: 'Test proxy switching with authentication'
  },
  {
    name: 'Proxy Health Check',
    file: 'health-check-test.js',
    description: 'Test proxy health monitoring system'
  },
  {
    name: 'API Requests Test',
    file: 'request-api-test.js',
    description: 'Test fetch-like API for requests'
  },
  {
    name: 'Quick Integration Test',
    file: 'quick-integration-test.js',
    description: 'Quick check of main components'
  },
  {
    name: 'Package Test',
    file: 'test-package.js',
    description: 'Test installed npm package'
  },
  {
    name: 'TTS ReadableStream Test',
    file: 'tts-readablestream-test.js',
    description: 'Test streaming data through proxy'
  }
];

// Function to clean logs
function cleanLogs() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
  logFiles.forEach(file => {
    const filePath = path.join(logsDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`${colors.yellow}🗑️  Cleaned log: ${file}${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}❌ Failed to delete log ${file}: ${err.message}${colors.reset}`);
    }
  });
}

// Function to run individual test
function runTest(test) {
  const testPath = path.join(__dirname, test.file);

  if (!fs.existsSync(testPath)) {
    console.log(`${colors.red}❌ Test file not found: ${test.file}${colors.reset}`);
    return { success: false, error: 'File not found' };
  }

  console.log(`\n${colors.cyan}📋 ${test.name}${colors.reset}`);
  console.log(`${colors.blue}   ${test.description}${colors.reset}`);
  console.log(`${colors.yellow}🔧 Running: ${test.file}${colors.reset}`);

  try {
    const startTime = Date.now();
    execSync(`node "${testPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    const duration = Date.now() - startTime;

    console.log(`${colors.green}✅ Test completed successfully (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    console.log(`${colors.red}❌ Test failed with error${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Main function
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING ALL PROXY-CONNECTION TESTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  // Check environment variables
  console.log(`${colors.yellow}🔍 Checking environment variables...${colors.reset}`);
  const requiredEnvVars = ['PROXY_LIST_PATH', 'TEST_URLS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(`${colors.red}⚠️  Missing environment variables: ${missingVars.join(', ')}${colors.reset}`);
    console.log(`${colors.yellow}💡 Make sure you created .env file with required variables${colors.reset}`);
    console.log(`${colors.blue}📖 Details in README.md${colors.reset}`);
  }

  // Check proxy list
  const proxyListPath = path.join(__dirname, '..', 'proxies-list.js');
  if (!fs.existsSync(proxyListPath)) {
    console.log(`${colors.red}⚠️  Proxy list file not found: proxies-list.js${colors.reset}`);
    console.log(`${colors.yellow}💡 Create file with working proxies for tests to work correctly${colors.reset}`);
  }

  console.log(`${colors.green}✅ Preliminary check completed${colors.reset}\n`);

  // Clean logs
  console.log(`${colors.yellow}🧹 Cleaning previous logs...${colors.reset}`);
  cleanLogs();  // Run tests
  const results = [];
  const startTime = Date.now();

  for (const test of tests) {
    const result = runTest(test);
    results.push({ test, result });

    // Pause between tests
    if (test !== tests[tests.length - 1]) {
      console.log(`${colors.blue}⏸️  Pause 2 seconds...${colors.reset}`);
      execSync('sleep 2');
    }
  }

  // Results report
  const overallDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.result.success).length;
  const failCount = results.length - successCount;

  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS REPORT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  console.log(`${colors.green}✅ Successful: ${successCount}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failCount}${colors.reset}`);
  console.log(`${colors.blue}⏱️  Total time: ${overallDuration}ms${colors.reset}`);

  console.log(`\n${colors.cyan}📋 Detailed results:${colors.reset}`);
  results.forEach(({ test, result }) => {
    const status = result.success ?
      `${colors.green}✅ SUCCESS${colors.reset}` :
      `${colors.red}❌ ERROR${colors.reset}`;
    const duration = result.duration ? ` (${result.duration}ms)` : '';

    console.log(`   ${status} ${test.name}${duration}`);
    if (!result.success && result.error) {
      console.log(`     ${colors.red}└─ ${result.error}${colors.reset}`);
    }
  });

  console.log(`\n${colors.yellow}📂 Logs saved to logs/ folder${colors.reset}`);

  // Exit code
  const exitCode = failCount > 0 ? 1 : 0;
  if (exitCode === 0) {
    console.log(`\n${colors.green}🎉 All tests completed successfully!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}💥 Some tests failed with errors${colors.reset}`);
  }

  process.exit(exitCode);
}

// Run if file is called directly
if (require.main === module) {
  main();
}

module.exports = { main, runTest, cleanLogs };
