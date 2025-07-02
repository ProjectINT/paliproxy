#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '.';

// Test functionality to verify logs
interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    user?: any;
    tags?: any;
    extras?: any;
    contexts?: any;
    breadcrumbs?: any;
    data?: any;
}

function parseLogFile(logPath: string): LogEntry[] {
  if (!existsSync(logPath)) {
    throw new Error(`Log file not found: ${logPath}`);
  }

  const logContent = readFileSync(logPath, 'utf-8');
  const logEntries: LogEntry[] = [];

  // Split by separator and parse each entry
  const entries = logContent.split('\n---\n').filter(entry => entry.trim());

  for (const entry of entries) {
    try {
      const parsed = JSON.parse(entry.trim());
      logEntries.push(parsed);
    } catch (error) {
      console.log('error', error);
      console.warn('Failed to parse log entry:', entry.substring(0, 100));
    }
  }

  return logEntries;
}

function runTests(logEntries: LogEntry[]): void {
  console.log('\n🧪 Running Log Tests...');

  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: Check if we have expected number of log entries
  testsTotal++;
  const expectedMinEntries = 5; // At least 5 log entries expected
  if (logEntries.length >= expectedMinEntries) {
    console.log(`✅ Test 1: Found ${logEntries.length} log entries (expected >= ${expectedMinEntries})`);
    testsPassed++;
  } else {
    console.log(`❌ Test 1: Found ${logEntries.length} log entries (expected >= ${expectedMinEntries})`);
  }

  // Test 2: Check if user information is set
  testsTotal++;
  const entriesWithUser = logEntries.filter(entry => entry.user && entry.user.id === 'demo-user');
  if (entriesWithUser.length > 0) {
    console.log(`✅ Test 2: User information found in ${entriesWithUser.length} entries`);
    testsPassed++;
  } else {
    console.log('❌ Test 2: No user information found in log entries');
  }

  // Test 3: Check if tags are set
  testsTotal++;
  const entriesWithTags = logEntries.filter(entry =>
    entry.tags &&
        entry.tags.environment === 'development' &&
        entry.tags.component === 'demo'
  );
  if (entriesWithTags.length > 0) {
    console.log(`✅ Test 3: Tags found in ${entriesWithTags.length} entries`);
    testsPassed++;
  } else {
    console.log('❌ Test 3: Expected tags not found in log entries');
  }

  // Test 4: Check if different severity levels are logged
  testsTotal++;
  const levels = new Set(logEntries.map(entry => entry.level));
  const expectedLevels = ['info', 'warning', 'error'];
  const foundExpectedLevels = expectedLevels.filter(level => levels.has(level));
  if (foundExpectedLevels.length === expectedLevels.length) {
    console.log(`✅ Test 4: All expected severity levels found: ${Array.from(levels).join(', ')}`);
    testsPassed++;
  } else {
    console.log(`❌ Test 4: Missing severity levels. Found: ${Array.from(levels).join(', ')}, Expected: ${expectedLevels.join(', ')}`);
  }

  // Test 5: Check if exception is logged
  testsTotal++;
  const exceptionEntries = logEntries.filter(entry =>
    entry.message.includes('Exception:') ||
        (entry.data && entry.data.name && entry.data.stack)
  );
  if (exceptionEntries.length > 0) {
    console.log(`✅ Test 5: Exception logging found in ${exceptionEntries.length} entries`);
    testsPassed++;
  } else {
    console.log('❌ Test 5: No exception logging found');
  }

  // Test 6: Check if breadcrumbs are present
  testsTotal++;
  const entriesWithBreadcrumbs = logEntries.filter(entry =>
    entry.breadcrumbs && entry.breadcrumbs.length > 0
  );
  if (entriesWithBreadcrumbs.length > 0) {
    console.log(`✅ Test 6: Breadcrumbs found in ${entriesWithBreadcrumbs.length} entries`);
    testsPassed++;
  } else {
    console.log('❌ Test 6: No breadcrumbs found in log entries');
  }

  // Test 7: Check if extras are logged
  testsTotal++;
  const entriesWithExtras = logEntries.filter(entry =>
    entry.extras && typeof entry.extras.step !== 'undefined'
  );
  if (entriesWithExtras.length > 0) {
    console.log(`✅ Test 7: Extra data found in ${entriesWithExtras.length} entries`);
    testsPassed++;
  } else {
    console.log('❌ Test 7: No extra data found in log entries');
  }

  // Test 8: Check timestamp format
  testsTotal++;
  const validTimestamps = logEntries.filter(entry => {
    try {
      const date = new Date(entry.timestamp);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  });
  if (validTimestamps.length === logEntries.length) {
    console.log('✅ Test 8: All timestamps are valid ISO format');
    testsPassed++;
  } else {
    console.log(`❌ Test 8: ${logEntries.length - validTimestamps.length} invalid timestamps found`);
  }

  // Summary
  console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);

  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! Logger is working correctly.');
  } else {
    console.log(`⚠️  ${testsTotal - testsPassed} tests failed. Please check the logger implementation.`);
  }

  // Display sample log entries for inspection
  console.log('\n📋 Sample Log Entries:');
  logEntries.slice(0, 2).forEach((entry, index) => {
    console.log(`\nEntry ${index + 1}:`);
    console.log(`  Level: ${entry.level}`);
    console.log(`  Message: ${entry.message}`);
    console.log(`  Timestamp: ${entry.timestamp}`);
    if (entry.user) {
      console.log(`  User: ${entry.user.username} (${entry.user.id})`);
    }
    if (entry.tags) {
      console.log(`  Tags: ${JSON.stringify(entry.tags)}`);
    }
  });
}

// Demo script to show logger functionality
async function demoLogger() {
  console.log('🚀 Logger Demo Started');

  // Clear previous logs for clean testing
  const logPath = join('./logs', 'app.log');

  // Set application context
  logger.setTags({
    environment: 'development',
    version: '1.0.0',
    component: 'demo'
  });

  logger.setUser({
    id: 'demo-user',
    username: 'demo',
    email: 'demo@palivpn.com'
  });

  // Basic logging
  await logger.captureMessage('Demo application started', 'info');

  // Add breadcrumbs
  logger.addBreadcrumb({
    message: 'User initiated demo',
    category: 'user_action',
    level: 'info'
  });

  // Simulate some application flow
  logger.setExtra('step', 1);
  await logger.captureMessage('Initializing components', 'info');

  logger.addBreadcrumb({
    message: 'Components initialized',
    category: 'system',
    level: 'info'
  });

  // Simulate a warning
  logger.setExtra('step', 2);
  await logger.captureMessage('Configuration file not found, using defaults', 'warning');

  // Simulate an error with context
  // Вместо withScope используем напрямую методы логгера
  logger.setTag('operation', 'network_test');
  logger.setExtra('attempt', 1);
  logger.addBreadcrumb({
    message: 'Attempting network connection',
    category: 'network',
    level: 'info'
  });

  // Simulate exception
  try {
    throw new Error('Network timeout after 5 seconds');
  } catch (error) {
    await logger.captureException(error as Error);
  }

  // Final message
  await logger.captureMessage('Demo completed', 'info');

  console.log('✅ Logger Demo Completed');
  console.log('📝 Logs written to ./logs/app.log');

  // Wait a bit to ensure all async operations complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Now test the logs
  try {
    const logEntries = parseLogFile(logPath);
    runTests(logEntries);
  } catch (error) {
    console.error('❌ Failed to read or parse log file:', error);
  }
}

// Run the demo
demoLogger().catch((error) => {
  console.error('Demo failed:', error);
  logger.captureException(error);
});
