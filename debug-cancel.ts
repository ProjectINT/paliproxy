import { ChannelSwitchManager } from './src/channelSwitchManager.js';

async function testZeroDurationDebug() {
    const testDelayedSwitchConfig = {
        enabled: true,
        maxDelayMs: 30000,
        criticalityThresholds: {
            immediate: 90,
            fast: 70,
            normal: 50,
            slow: 30
        },
        gracePeriodMs: 5000
    };

    console.log('Testing zero duration operation...');
    const manager = new ChannelSwitchManager(testDelayedSwitchConfig as any);
    console.log('Manager created');

    const createOperation = (partial: any) => {
        return {
            type: partial.type || 'http_request',
            criticalityLevel: partial.criticalityLevel || 50,
            startedAt: partial.startedAt || Date.now(),
            estimatedDuration: partial.estimatedDuration || 5000,
            canInterrupt: partial.canInterrupt !== undefined ? partial.canInterrupt : true,
            ...(partial.onComplete && { onComplete: partial.onComplete }),
            ...(partial.onInterrupt && { onInterrupt: partial.onInterrupt })
        };
    };

    const operationId = await manager.registerOperation(createOperation({
        type: 'http_request',
        criticalityLevel: 60,
        estimatedDuration: 0
    }));

    console.log('Operation registered with ID:', operationId);
    console.log('Active operations count:', manager.activeOperations.length);
    
    const operation = manager.activeOperations.find(op => op.id === operationId);
    console.log('Found operation:', operation);

    const optimalTime = manager.getOptimalSwitchTime();
    const now = Date.now();
    
    console.log('Optimal switch time:', optimalTime);
    console.log('Current time:', now);
    console.log('Difference:', Math.abs(optimalTime - now));

    // Wait a bit for setImmediate to execute
    await new Promise(resolve => setTimeout(resolve, 10));
    
    console.log('Active operations count after wait:', manager.activeOperations.length);
    
    const optimalTime2 = manager.getOptimalSwitchTime();
    console.log('Optimal switch time after wait:', optimalTime2);
    console.log('Difference after wait:', Math.abs(optimalTime2 - now));

    console.log('✅ Zero duration debug completed');
}

testZeroDurationDebug().catch(console.error);
