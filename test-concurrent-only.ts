#!/usr/bin/env npx tsx

// Import the test suite
async function runConcurrentConnectionsTest() {
    console.log('🧪 Running Concurrent Connections Test...');
    console.log('========================================');
    
    try {
        // Import dynamically to avoid path issues
        const { VPNManagerTestSuite } = await import('./src/tests/manager.test.js');
        const testSuite = new VPNManagerTestSuite();
        
        // Run just the concurrent connections test
        await (testSuite as any).testConcurrentConnections();
        console.log('');
        console.log('✅ SUCCESS: Concurrent connections test PASSED');
        console.log('✅ The semaphore deadlock fix is working correctly!');
    } catch (error) {
        console.error('');
        console.error('❌ FAILED: Concurrent connections test FAILED:', error);
        process.exit(1);
    }
}

runConcurrentConnectionsTest().catch(console.error);
