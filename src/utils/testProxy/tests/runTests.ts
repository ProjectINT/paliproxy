#!/usr/bin/env node

// Simple test runner for all tests in the tests directory
import { readdirSync } from 'fs';
import { join } from 'path';

async function runAllTests() {
  console.log('🧪 Running All Tests...\n');

  const testsDir = join(__dirname);
  const testFiles = readdirSync(testsDir)
    .filter(file => file.endsWith('.test.ts') || file.endsWith('.test.js'))
    .filter(file => file !== 'runTests.ts');

  if (testFiles.length === 0) {
    console.log('No test files found');
    return;
  }

  const totalPassed = 0;
  let totalFailed = 0;

  for (const testFile of testFiles) {
    console.log(`\n📋 Running ${testFile}...`);
    console.log('─'.repeat(50));

    try {
      // Import and run the test
      const testModule = require(join(testsDir, testFile));

      // If the test file has a run method, call it
      if (testModule.run && typeof testModule.run === 'function') {
        await testModule.run();
      }
    } catch (error) {
      console.error(`❌ Failed to run ${testFile}:`, error);
      totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Overall Results: ${totalPassed} test files passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
