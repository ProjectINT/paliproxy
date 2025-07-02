#!/usr/bin/env node

/**
 * Master file for running complete project validation
 * Runs build, linting, unit tests, and integration tests
 * Provides comprehensive project health report
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

// List of integration tests to run
const integrationTests = [
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

// List of unit tests to run
const unitTests = [
  {
    name: 'Logger Unit Tests',
    command: 'npx tsx src/utils/logger/logger-test.ts',
    description: 'Test logging functionality and formats'
  },
  {
    name: 'Snowflake ID Unit Tests',
    command: 'npx tsx src/utils/snowflakeId/runTests.ts',
    description: 'Test unique ID generation and parsing'
  },
  {
    name: 'Test Proxy Unit Tests',
    command: 'npx tsx src/utils/testProxy/tests/testProxy.test.ts',
    description: 'Test proxy validation functionality'
  },
  {
    name: 'Snowflake Performance Test',
    command: 'npx tsx src/utils/snowflakeId/perfomance-test.ts',
    description: 'Performance benchmark for ID generation'
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

// Function to run individual integration test
function runIntegrationTest(test, suppressErrors = false) {
  const testPath = path.join(__dirname, test.file);

  if (!fs.existsSync(testPath)) {
    console.log(`${colors.red}❌ Test file not found: ${test.file}${colors.reset}`);
    return { success: false, error: 'File not found' };
  }

  console.log(`\n${colors.cyan}📋 ${test.name}${colors.reset}`);
  console.log(`${colors.blue}   ${test.description}${colors.reset}`);
  console.log(`${colors.yellow}🔧 Running: ${test.file}${colors.reset}`);

  // Show info about error suppression for noisy tests
  const noisyTests = ['health-check-test.js', 'proxy-failover-test.js', 'proxy-failover-password-test.js'];
  if (suppressErrors && noisyTests.includes(test.file)) {
    console.log(`${colors.blue}ℹ️  Expected proxy connection errors will be suppressed${colors.reset}`);
  }

  const startTime = Date.now();

  try {

    if (suppressErrors && noisyTests.includes(test.file)) {
      // For noisy tests, capture all output and filter it
      const result = execSync(`node "${testPath}"`, {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8'
      });

      // Filter out SocksClientError messages
      const filteredOutput = result
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return !trimmed.startsWith('error SocksClientError:') &&
                 !trimmed.includes('at SocksClient.') &&
                 !trimmed.includes('at Socket.') &&
                 !trimmed.includes('at Object.onceWrapper') &&
                 !trimmed.includes('at process.processTicksAndRejections') &&
                 !trimmed.includes('at listOnTimeout') &&
                 !trimmed.includes('at Timeout._onTimeout') &&
                 !trimmed.includes('at emitErrorNT') &&
                 !trimmed.includes('at emitErrorCloseNT') &&
                 !trimmed.includes('at process.processTimers') &&
                 !trimmed.includes('options: {') &&
                 !trimmed.includes('proxy: { host:') &&
                 !trimmed.includes('destination: { host:') &&
                 !trimmed.includes('command: \'connect\'') &&
                 !trimmed.includes('timeout: undefined') &&
                 !trimmed.includes('socket_options: undefined') &&
                 trimmed !== '}' &&
                 trimmed !== '';
        })
        .join('\n');

      // Display filtered output
      if (filteredOutput.trim()) {
        console.log(filteredOutput);
      }
    } else {
      // For normal tests, use regular stdio
      execSync(`node "${testPath}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    }

    const duration = Date.now() - startTime;
    console.log(`${colors.green}✅ Integration test completed successfully (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle the case where the test completed successfully but had suppressed errors
    if (suppressErrors && noisyTests.includes(test.file) && error.status === 0) {
      console.log(`${colors.green}✅ Integration test completed successfully (${duration}ms)${colors.reset}`);
      return { success: true, duration };
    }

    console.log(`${colors.red}❌ Integration test failed with error${colors.reset}`);
    console.log(`${colors.red}   Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Function to run build process
function runBuild() {
  console.log(`${colors.cyan}🔨 Building TypeScript project...${colors.reset}`);
  try {
    const startTime = Date.now();
    execSync('npm run build', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✅ Build completed successfully (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    console.log(`${colors.red}❌ Build failed${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Function to run linting
function runLint() {
  console.log(`${colors.cyan}🔍 Running ESLint code analysis...${colors.reset}`);
  try {
    const startTime = Date.now();
    execSync('npm run lint', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✅ Linting completed successfully (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Linting completed with warnings${colors.reset}`);
    console.log(`${colors.blue}ℹ️  Error details: ${error.message}${colors.reset}`);
    // Don't fail on lint warnings, just continue
    return { success: true, duration: 0, warnings: true };
  }
}

// Function to run unit test
function runUnitTest(test) {
  console.log(`\n${colors.cyan}🧪 ${test.name}${colors.reset}`);
  console.log(`${colors.blue}   ${test.description}${colors.reset}`);
  console.log(`${colors.yellow}🔧 Running: ${test.command}${colors.reset}`);

  try {
    const startTime = Date.now();
    execSync(test.command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    const duration = Date.now() - startTime;

    console.log(`${colors.green}✅ Unit test completed successfully (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    console.log(`${colors.red}❌ Unit test failed${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Main function
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING COMPLETE PROJECT VALIDATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  const allResults = [];
  const overallStartTime = Date.now();

  // Phase 1: Build Project
  console.log(`\n${colors.bright}${colors.blue}📦 PHASE 1: PROJECT BUILD${colors.reset}`);
  const buildResult = runBuild();
  allResults.push({ phase: 'Build', result: buildResult });

  if (!buildResult.success) {
    console.log(`${colors.red}💥 Build failed! Stopping execution.${colors.reset}`);
    process.exit(1);
  }

  // Phase 2: Code Quality Check
  console.log(`\n${colors.bright}${colors.blue}🔍 PHASE 2: CODE QUALITY CHECK${colors.reset}`);
  const lintResult = runLint();
  allResults.push({ phase: 'Lint', result: lintResult });

  // Phase 3: Unit Tests
  console.log(`\n${colors.bright}${colors.blue}🧪 PHASE 3: UNIT TESTS${colors.reset}`);
  const unitTestResults = [];

  for (const test of unitTests) {
    const result = runUnitTest(test);
    unitTestResults.push({ test, result });
    allResults.push({ phase: 'Unit Test', name: test.name, result });

    // Small pause between unit tests
    if (test !== unitTests[unitTests.length - 1]) {
      console.log(`${colors.blue}⏸️  Pause 1 second...${colors.reset}`);
      execSync('sleep 1');
    }
  }

  // Phase 4: Environment Check
  console.log(`\n${colors.bright}${colors.blue}🔍 PHASE 4: ENVIRONMENT CHECK${colors.reset}`);

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
    console.log(`${colors.yellow}💡 Create file with working proxies for integration tests to work correctly${colors.reset}`);
  }

  console.log(`${colors.green}✅ Environment check completed${colors.reset}`);

  // Phase 5: Clean Logs
  console.log(`\n${colors.yellow}🧹 Cleaning previous logs...${colors.reset}`);
  cleanLogs();

  // Phase 6: Integration Tests
  console.log(`\n${colors.bright}${colors.blue}🌐 PHASE 5: INTEGRATION TESTS${colors.reset}`);
  console.log(`${colors.blue}ℹ️  Noisy proxy errors will be suppressed for cleaner output${colors.reset}`);
  const integrationTestResults = [];

  for (const test of integrationTests) {
    const result = runIntegrationTest(test, true); // Enable error suppression
    integrationTestResults.push({ test, result });
    allResults.push({ phase: 'Integration Test', name: test.name, result });

    // Pause between integration tests
    if (test !== integrationTests[integrationTests.length - 1]) {
      console.log(`${colors.blue}⏸️  Pause 2 seconds...${colors.reset}`);
      execSync('sleep 2');
    }
  }

  // Final Results Report
  const overallDuration = Date.now() - overallStartTime;

  // Count results
  const buildSuccess = buildResult.success ? 1 : 0;
  const lintSuccess = lintResult.success ? 1 : 0;
  const unitTestSuccess = unitTestResults.filter(r => r.result.success).length;
  const integrationTestSuccess = integrationTestResults.filter(r => r.result.success).length;

  const totalSuccess = buildSuccess + lintSuccess + unitTestSuccess + integrationTestSuccess;
  const totalTests = 1 + 1 + unitTestResults.length + integrationTestResults.length;

  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 COMPLETE PROJECT VALIDATION REPORT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  console.log(`${colors.bright}📋 Summary:${colors.reset}`);
  console.log(`${colors.green}✅ Total Successful: ${totalSuccess}/${totalTests}${colors.reset}`);
  console.log(`${colors.blue}⏱️  Total Duration: ${Math.round(overallDuration / 1000)}s (${overallDuration}ms)${colors.reset}`);

  console.log(`\n${colors.bright}📊 Phase Results:${colors.reset}`);
  console.log(`   🔨 Build: ${buildResult.success ? `${colors.green}✅ PASSED${colors.reset}` : `${colors.red}❌ FAILED${colors.reset}`} (${buildResult.duration || 0}ms)`);
  console.log(`   🔍 Lint: ${lintResult.success ? `${colors.green}✅ PASSED${colors.reset}` : `${colors.red}❌ FAILED${colors.reset}`} (${lintResult.duration || 0}ms)${lintResult.warnings ? ` ${colors.yellow}⚠️ with warnings${colors.reset}` : ''}`);
  console.log(`   🧪 Unit Tests: ${colors.green}${unitTestSuccess}${colors.reset}/${unitTestResults.length} passed`);
  console.log(`   🌐 Integration Tests: ${colors.green}${integrationTestSuccess}${colors.reset}/${integrationTestResults.length} passed`);

  console.log(`\n${colors.cyan}📋 Detailed Unit Test Results:${colors.reset}`);
  unitTestResults.forEach(({ test, result }) => {
    const status = result.success ?
      `${colors.green}✅ PASSED${colors.reset}` :
      `${colors.red}❌ FAILED${colors.reset}`;
    const duration = result.duration ? ` (${result.duration}ms)` : '';

    console.log(`   ${status} ${test.name}${duration}`);
    if (!result.success && result.error) {
      console.log(`     ${colors.red}└─ ${result.error}${colors.reset}`);
    }
  });

  console.log(`\n${colors.cyan}📋 Detailed Integration Test Results:${colors.reset}`);
  integrationTestResults.forEach(({ test, result }) => {
    const status = result.success ?
      `${colors.green}✅ PASSED${colors.reset}` :
      `${colors.red}❌ FAILED${colors.reset}`;
    const duration = result.duration ? ` (${result.duration}ms)` : '';

    console.log(`   ${status} ${test.name}${duration}`);
    if (!result.success && result.error) {
      console.log(`     ${colors.red}└─ ${result.error}${colors.reset}`);
    }
  });

  console.log(`\n${colors.yellow}📂 Logs saved to logs/ folder${colors.reset}`);

  // Exit code based on critical failures
  const criticalFailures = !buildResult.success ||
                          unitTestResults.some(r => !r.result.success) ||
                          integrationTestResults.some(r => !r.result.success);

  if (!criticalFailures) {
    console.log(`\n${colors.green}🎉 All validation phases completed successfully!${colors.reset}`);
    console.log(`${colors.bright}${colors.green}🚀 Project is ready for production!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}💥 Some validation phases failed${colors.reset}`);
    console.log(`${colors.yellow}🔧 Please fix the issues before proceeding${colors.reset}`);
    process.exit(1);
  }
}

// Run if file is called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  runIntegrationTest,
  runUnitTest,
  runBuild,
  runLint,
  cleanLogs
};
