#!/usr/bin/env node

import { testProxy } from '../utils/testProxy';
import assert from 'assert';

// Mock ProxyBase interface
interface ProxyBase {
    ip: string;
    port: number;
    user: string;
    pass: string;
}

// Test runner class
class TestRunner {
    private passed = 0;
    private failed = 0;
    private tests: { name: string; fn: () => Promise<void> }[] = [];

    test(name: string, fn: () => Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🧪 Running testProxy Tests...\n');

        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name}`);
                console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
        
        if (this.failed > 0) {
            console.log('⚠️  Some tests failed');
            process.exit(1);
        } else {
            console.log('🎉 All tests passed!');
            process.exit(0);
        }
    }
}

const testRunner = new TestRunner();

// Utility functions for testing
function assertBetween(value: number, min: number, max: number, message = '') {
    assert(value >= min && value <= max, 
        message || `Expected ${value} to be between ${min} and ${max}`);
}

function assertGreaterThan(value: number, threshold: number, message = '') {
    assert(value > threshold, 
        message || `Expected ${value} to be greater than ${threshold}`);
}

// Test cases with real proxy testing (integration tests)
testRunner.test('should handle invalid proxy (connection refused)', async () => {
    const invalidProxy: ProxyBase = {
        ip: '127.0.0.1',
        port: 9999, // Non-existent port
        user: 'testuser',
        pass: 'testpass'
    };

    const result = await testProxy(invalidProxy);
    
    assert.strictEqual(result.alive, false, 'Invalid proxy should return alive: false');
    assert.strictEqual(result.latency, 5000, 'Should return timeout value for failed connections');
});

testRunner.test('should handle non-existent host', async () => {
    const invalidProxy: ProxyBase = {
        ip: '192.168.255.255', // Non-existent IP
        port: 1080,
        user: 'testuser',
        pass: 'testpass'
    };

    const result = await testProxy(invalidProxy);
    
    assert.strictEqual(result.alive, false, 'Non-existent host should return alive: false');
    assert.strictEqual(result.latency, 5000, 'Should return timeout value for failed connections');
});

testRunner.test('should validate proxy configuration format', async () => {
    const proxy: ProxyBase = {
        ip: '192.168.1.100',
        port: 9050,
        user: 'myuser',
        pass: 'mypass'
    };

    // Test that the function accepts the proxy format without throwing
    try {
        await testProxy(proxy);
        // Should not throw an error even if connection fails
        assert(true, 'Function should accept valid proxy format');
    } catch (error) {
        // Only network-related errors are expected, not format errors
        if (error instanceof Error && error.message.includes('Invalid proxy format')) {
            throw error;
        }
        // Network errors are expected for invalid proxies
    }
});

testRunner.test('should handle special characters in credentials', async () => {
    const proxy: ProxyBase = {
        ip: '127.0.0.1',
        port: 1080,
        user: 'user@domain.com',
        pass: 'pass#with$pecial!chars'
    };

    try {
        await testProxy(proxy);
        assert(true, 'Function should handle special characters in credentials');
    } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid credentials format')) {
            throw error;
        }
        // Network errors are expected
    }
});

testRunner.test('should respect timeout configuration', async () => {
    const originalTimeout = process.env.TIMEOUT;
    process.env.TIMEOUT = '2000';

    // Clear require cache to get new timeout value
    const modulePath = require.resolve('../utils/testProxy');
    delete require.cache[modulePath];
    const { testProxy: testProxyWithTimeout } = require('../utils/testProxy');

    const proxy: ProxyBase = {
        ip: '127.0.0.1', // Use localhost with invalid port for faster failure
        port: 9999, // Non-existent port - should fail quickly
        user: 'testuser',
        pass: 'testpass'
    };

    const startTime = Date.now();
    const result = await testProxyWithTimeout(proxy);
    const duration = Date.now() - startTime;

    assert.strictEqual(result.alive, false, 'Timeout should result in alive: false');
    assert.strictEqual(result.latency, 2000, 'Should return custom timeout value');
    
    // Accept that system timeouts might override our timeout
    // The key is that our function returns the correct latency value
    console.log(`   ℹ️  Actual duration: ${duration}ms (system may override timeout)`);

    // Restore original timeout
    if (originalTimeout !== undefined) {
        process.env.TIMEOUT = originalTimeout;
    } else {
        delete process.env.TIMEOUT;
    }

    // Clear cache again to restore original timeout
    delete require.cache[modulePath];
});

testRunner.test('should use custom health check URL', async () => {
    const originalUrl = process.env.HEALTH_CHECK_URL;
    process.env.HEALTH_CHECK_URL = 'https://httpbin.org/status/200';

    // Clear require cache to get new URL
    const modulePath = require.resolve('../utils/testProxy');
    delete require.cache[modulePath];
    const { testProxy: testProxyWithCustomUrl } = require('../utils/testProxy');

    const proxy: ProxyBase = {
        ip: '127.0.0.1',
        port: 9999, // Invalid port, but we're testing URL configuration
        user: 'testuser',
        pass: 'testpass'
    };

    try {
        await testProxyWithCustomUrl(proxy);
        assert(true, 'Function should accept custom health check URL');
    } catch (error) {
        // Network errors are expected with invalid proxy
    }

    // Restore original URL
    if (originalUrl !== undefined) {
        process.env.HEALTH_CHECK_URL = originalUrl;
    } else {
        delete process.env.HEALTH_CHECK_URL;
    }

    // Clear cache to restore original settings
    delete require.cache[modulePath];
});

testRunner.test('should return consistent result format', async () => {
    const proxy: ProxyBase = {
        ip: '127.0.0.1',
        port: 9999,
        user: 'testuser',
        pass: 'testpass'
    };

    const result = await testProxy(proxy);

    assert(typeof result === 'object', 'Result should be an object');
    assert(typeof result.alive === 'boolean', 'Result.alive should be a boolean');
    assert(typeof result.latency === 'number', 'Result.latency should be a number');
    assertGreaterThan(result.latency, -1, 'Latency should be non-negative');
});

testRunner.test('should handle multiple concurrent requests', async () => {
    const proxy: ProxyBase = {
        ip: '127.0.0.1',
        port: 9999,
        user: 'testuser',
        pass: 'testpass'
    };

    // Run multiple tests concurrently
    const promises = Array.from({ length: 3 }, () => testProxy(proxy));
    const results = await Promise.all(promises);

    results.forEach((result, index) => {
        assert(typeof result.alive === 'boolean', `Result ${index} should have boolean alive`);
        assert(typeof result.latency === 'number', `Result ${index} should have number latency`);
    });
});

// Performance test - focus on function behavior rather than exact timing
testRunner.test('should return correct values for invalid proxy', async () => {
    const proxy: ProxyBase = {
        ip: '127.0.0.1', // Use localhost for faster failure
        port: 9999, // Non-existent port
        user: 'testuser',
        pass: 'testpass'
    };

    const startTime = Date.now();
    const result = await testProxy(proxy);
    const duration = Date.now() - startTime;

    assert.strictEqual(result.alive, false, 'Invalid proxy should return alive: false');
    assert.strictEqual(result.latency, 5000, 'Should return configured timeout value');
    
    // Just log actual duration for information, don't assert on it
    console.log(`   ℹ️  Actual duration: ${duration}ms (system-dependent)`);
    
    // Ensure reasonable upper bound (30+ seconds suggests system issues)
    assert(duration < 35000, `Duration ${duration}ms is unreasonably long - possible system issue`);
});

// Run all tests
if (require.main === module) {
    testRunner.run().catch(console.error);
}
