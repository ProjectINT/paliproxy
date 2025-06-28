/**
 * Полные тесты для ChannelSwitchManager
 */

import { EventEmitter } from 'events';
import { ChannelSwitchManager } from '../channelSwitchManager';
import { 
    DelayedSwitchConfig,
    VPNConfig,
    SwitchReason,
    SwitchPriority,
    ActiveOperation,
    PendingSwitchRequest,
    SwitchDecision 
} from '../types';
import { logger, delay } from '../utils';

// === ТЕСТОВЫЕ ДАННЫЕ ===

const testVPNs: VPNConfig[] = [
    {
        name: 'primary-vpn',
        config: 'client\nremote vpn1.example.com 1194',
        priority: 1,
        active: true,
        type: 'openvpn'
    },
    {
        name: 'backup-vpn',
        config: '[Interface]\nPrivateKey = test',
        priority: 2,
        active: false,
        type: 'wireguard'
    },
    {
        name: 'emergency-vpn',
        config: '{"server": "ikev2.example.com"}',
        priority: 3,
        active: false,
        type: 'ikev2'
    }
];

const testDelayedSwitchConfig: DelayedSwitchConfig = {
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

const fastDelayedSwitchConfig: DelayedSwitchConfig = {
    enabled: true,
    maxDelayMs: 2000,
    criticalityThresholds: {
        immediate: 90,
        fast: 70,
        normal: 50,
        slow: 30
    },
    gracePeriodMs: 500
};

// === ТЕСТОВЫЙ SUITE ===

class ChannelSwitchManagerTestSuite {
    private totalTests = 0;
    private passedTests = 0;
    private failedTests = 0;
    
    /**
     * Вспомогательная функция для создания полной операции
     */
    private createOperation(partial: Partial<ActiveOperation>): Omit<ActiveOperation, 'id'> {
        return {
            type: partial.type || 'http_request',
            criticalityLevel: partial.criticalityLevel || 50,
            startedAt: partial.startedAt || Date.now(),
            estimatedDuration: partial.estimatedDuration !== undefined ? partial.estimatedDuration : 5000,
            canInterrupt: partial.canInterrupt !== undefined ? partial.canInterrupt : true,
            ...(partial.onComplete && { onComplete: partial.onComplete }),
            ...(partial.onInterrupt && { onInterrupt: partial.onInterrupt })
        };
    }
    
    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        this.totalTests++;
        logger.info(`🧪 Running ChannelSwitchManager test: ${testName}`);
        
        try {
            await testFn();
            this.passedTests++;
            logger.info(`✅ Test passed: ${testName}`);
        } catch (error) {
            this.failedTests++;
            logger.error(`❌ Test failed: ${testName}`, error);
            throw error;
        }
    }
    
    private printSummary(): void {
        logger.info(`\n=== CHANNELSWITCHMANAGER TEST SUMMARY ===`);
        logger.info(`Total tests: ${this.totalTests}`);
        logger.info(`Passed: ${this.passedTests}`);
        logger.info(`Failed: ${this.failedTests}`);
        logger.info(`Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    }
    
    private assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    private assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
        if (value == null) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    private waitForEvent(emitter: EventEmitter, eventName: string, timeout = 3000): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for event: ${eventName}`));
            }, timeout);
            
            emitter.once(eventName, (...args) => {
                clearTimeout(timer);
                resolve(args);
            });
        });
    }
    
    // === ТЕСТЫ КОНСТРУКТОРА И ИНИЦИАЛИЗАЦИИ ===
    
    private async testConstructor(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        this.assert(manager.isEnabled === true, 'Should be enabled');
        this.assert(manager.pendingSwitches.length === 0, 'Should have no pending switches initially');
        this.assert(manager.activeOperations.length === 0, 'Should have no active operations initially');
    }
    
    private async testConstructorDisabled(): Promise<void> {
        const disabledConfig = { ...testDelayedSwitchConfig, enabled: false };
        const manager = new ChannelSwitchManager(disabledConfig);
        
        this.assert(manager.isEnabled === false, 'Should be disabled');
    }
    
    // === ТЕСТЫ РЕГИСТРАЦИИ ОПЕРАЦИЙ ===
    
    private async testRegisterOperation(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const operationId = await manager.registerOperation({
            type: 'http_request',
            criticalityLevel: 60,
            startedAt: Date.now(),
            estimatedDuration: 5000,
            canInterrupt: true
        });
        
        this.assert(typeof operationId === 'string', 'Operation ID should be string');
        this.assert(operationId.length > 0, 'Operation ID should not be empty');
        this.assert(manager.activeOperations.length === 1, 'Should have one active operation');
        
        const operation = manager.activeOperations.find(op => op.id === operationId);
        this.assertNotNull(operation, 'Should find operation by ID');
        this.assert(operation.type === 'http_request', 'Should have correct type');
        this.assert(operation.criticalityLevel === 60, 'Should have correct criticality level');
    }
    
    private async testRegisterOperationWithDefaults(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const operationId = await manager.registerOperation({
            type: 'file_transfer',
            criticalityLevel: 50,
            startedAt: Date.now(),
            estimatedDuration: 5000,
            canInterrupt: true
        });
        
        const operation = manager.activeOperations.find(op => op.id === operationId);
        this.assertNotNull(operation, 'Should find operation by ID');
        this.assert(operation.criticalityLevel === 50, 'Should use provided criticality level');
        this.assert(operation.estimatedDuration === 5000, 'Should use provided estimated duration');
        this.assert(operation.canInterrupt === true, 'Should use provided canInterrupt');
    }
    
    private async testCompleteOperation(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const operationId = await manager.registerOperation({
            type: 'http_request',
            criticalityLevel: 60,
            startedAt: Date.now(),
            estimatedDuration: 5000,
            canInterrupt: true
        });
        
        this.assert(manager.activeOperations.length === 1, 'Should have one active operation');
        
        manager.completeOperation(operationId);
        
        // Wait a bit for the async mutex operation to complete
        await delay(10);
        
        this.assert(manager.activeOperations.length === 0, 'Should have no active operations after completion');
    }
    
    private async testCompleteNonexistentOperation(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        // Завершение несуществующей операции не должно вызывать ошибок
        manager.completeOperation('nonexistent-id');
        
        this.assert(manager.activeOperations.length === 0, 'Should remain empty');
    }
    
    private async testOperationCallback(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        let callbackCalled = false;
        const operationId = await manager.registerOperation(this.createOperation({
            type: 'http_request',
            criticalityLevel: 60,
            onComplete: () => {
                callbackCalled = true;
            }
        }));
        
        manager.completeOperation(operationId);
        
        // Wait a bit for the async mutex operation to complete
        await delay(10);
        
        this.assert(callbackCalled, 'onComplete callback should be called');
    }
    
    // === ТЕСТЫ ПРИНЯТИЯ РЕШЕНИЙ О ПЕРЕКЛЮЧЕНИИ ===
    
    private async testGetSwitchDecisionImmediate(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const decision = manager.getSwitchDecision(
            testVPNs[1]!,
            'emergency',
            'emergency'
        );
        
        this.assert(decision.action === 'immediate', 'Emergency should be immediate');
        this.assert(decision.delayMs === 0, 'Emergency should have no delay');
        this.assert(decision.reason.includes('emergency'), 'Should mention emergency in reason');
    }
    
    private async testGetSwitchDecisionDelayed(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const decision = manager.getSwitchDecision(
            testVPNs[1]!,
            'optimization',
            'low'
        );
        
        this.assert(decision.action === 'delayed', 'Low priority should be delayed');
        this.assert(decision.delayMs > 0, 'Should have positive delay');
        this.assert(decision.delayMs <= testDelayedSwitchConfig.maxDelayMs, 'Should not exceed max delay');
    }
    
    private async testGetSwitchDecisionWithActiveOperations(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        // Регистрируем критичную операцию
        await manager.registerOperation(this.createOperation({
            type: 'file_transfer',
            criticalityLevel: 85,
            estimatedDuration: 10000,
            canInterrupt: false
        }));
        
        const decision = manager.getSwitchDecision(
            testVPNs[1]!,
            'user_request',
            'normal'
        );
        
        this.assert(decision.action === 'delayed', 'Should be delayed due to critical operation');
        this.assert(decision.delayMs >= 10000, 'Should wait for operation to complete');
    }
    
    private async testGetSwitchDecisionWithInterruptibleOperations(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        // Регистрируем прерываемую операцию
        await manager.registerOperation(this.createOperation({
            type: 'http_request',
            criticalityLevel: 60,
            estimatedDuration: 10000,
            canInterrupt: true
        }));
        
        const decision = manager.getSwitchDecision(
            testVPNs[1]!,
            'health_check_failed',
            'high'
        );
        
        // Высокий приоритет должен позволить прерывание
        this.assert(decision.action === 'immediate' || decision.action === 'delayed', 'High priority should not be rejected');
        this.assert(decision.delayMs < 10000, 'Should not wait full operation duration');
    }
    
    private async testGetOptimalSwitchTime(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const baseTime = Date.now();
        const optimalTime = manager.getOptimalSwitchTime();
        
        // Без активных операций, оптимальное время должно быть близко к текущему
        this.assert(Math.abs(optimalTime - baseTime) < 1000, 'Should be close to current time without operations');
        
        // Добавляем операцию
        await manager.registerOperation(this.createOperation({
            type: 'file_transfer',
            criticalityLevel: 80,
            estimatedDuration: 5000,
            canInterrupt: false
        }));
        
        const optimalTimeWithOperation = manager.getOptimalSwitchTime();
        this.assert(optimalTimeWithOperation > baseTime + 4000, 'Should account for operation duration');
    }
    
    // === ТЕСТЫ ЗАПРОСА ПЕРЕКЛЮЧЕНИЯ ===
    
    private async testRequestSwitch(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'user_request',
            'normal',
            60
        );
        
        this.assert(typeof switchId === 'string', 'Switch ID should be string');
        this.assert(switchId.length > 0, 'Switch ID should not be empty');
        this.assert(manager.pendingSwitches.length === 1, 'Should have one pending switch');
        
        const switchRequest = manager.pendingSwitches.find(s => s.id === switchId);
        this.assertNotNull(switchRequest, 'Should find switch request by ID');
        this.assert(switchRequest.targetVPN === testVPNs[1], 'Should target correct VPN');
        this.assert(switchRequest.reason === 'user_request', 'Should have correct reason');
        this.assert(switchRequest.priority === 'normal', 'Should have correct priority');
    }
    
    private async testRequestImmediateSwitch(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const immediatePromise = this.waitForEvent(manager, 'immediateSwitch');
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'emergency',
            'emergency',
            95
        );
        
        const [switchRequest] = await immediatePromise;
        
        this.assert(switchRequest.id === switchId, 'Should emit immediate switch event');
        this.assert(switchRequest.targetVPN === testVPNs[1], 'Should target correct VPN');
    }
    
    private async testRequestDelayedSwitch(): Promise<void> {
        const manager = new ChannelSwitchManager(fastDelayedSwitchConfig);
        
        const delayedPromise = this.waitForEvent(manager, 'delayedSwitch');
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'optimization',
            'low',
            30
        );
        
        // Ждем отложенного переключения
        const [switchRequest] = await delayedPromise;
        
        this.assert(switchRequest.id === switchId, 'Should emit delayed switch event');
        this.assert(switchRequest.targetVPN === testVPNs[1], 'Should target correct VPN');
    }
    
    private async testCancelSwitch(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'optimization',
            'low',
            30
        );
        
        this.assert(manager.pendingSwitches.length === 1, 'Should have pending switch');
        
        const cancelled = manager.cancelSwitch(switchId);
        
        this.assert(cancelled === true, 'Should successfully cancel switch');
        this.assert(manager.pendingSwitches.length === 0, 'Should have no pending switches after cancellation');
    }
    
    private async testCancelNonexistentSwitch(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const cancelled = manager.cancelSwitch('nonexistent-id');
        
        this.assert(cancelled === false, 'Should not cancel nonexistent switch');
    }
    
    private async testCancelSwitchEvent(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const cancelledPromise = this.waitForEvent(manager, 'switchCancelled');
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'optimization',
            'low',
            30
        );
        
        manager.cancelSwitch(switchId);
        
        const [cancelledSwitchId, reason] = await cancelledPromise;
        
        this.assert(cancelledSwitchId === switchId, 'Should emit cancellation event with correct ID');
        this.assert(typeof reason === 'string', 'Should provide cancellation reason');
    }
    
    // === ТЕСТЫ СОБЫТИЙ ===
    
    private async testSwitchScheduledEvent(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const scheduledPromise = this.waitForEvent(manager, 'switchScheduled');
        
        await manager.requestSwitch(
            testVPNs[1]!,
            'optimization',
            'low',
            30
        );
        
        const [switchRequest] = await scheduledPromise;
        
        this.assert(switchRequest.targetVPN === testVPNs[1], 'Should emit scheduled event with correct VPN');
        this.assert(switchRequest.scheduledAt > Date.now(), 'Should be scheduled for future');
    }
    
    private async testSwitchCompletedEvent(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const switchId = await manager.requestSwitch(
            testVPNs[1]!,
            'emergency',
            'emergency',
            95
        );
        
        const completedPromise = this.waitForEvent(manager, 'switchCompleted');
        
        // Эмулируем успешное завершение переключения
        manager.emit('switchCompleted', switchId, true);
        
        const [completedSwitchId, success] = await completedPromise;
        
        this.assert(completedSwitchId === switchId, 'Should emit completion event with correct ID');
        this.assert(success === true, 'Should indicate success');
    }
    
    // === ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ И НАГРУЗКИ ===
    
    private async testMultipleConcurrentSwitches(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const switchPromises = Array.from({ length: 5 }, (_, i) =>
            manager.requestSwitch(
                testVPNs[i % testVPNs.length]!,
                'optimization',
                'low',
                30 + i * 10
            )
        );
        
        const switchIds = await Promise.all(switchPromises);
        
        this.assert(switchIds.length === 5, 'Should handle multiple concurrent switches');
        this.assert(new Set(switchIds).size === 5, 'Should generate unique IDs');
        this.assert(manager.pendingSwitches.length === 5, 'Should track all pending switches');
    }
    
    private async testManyOperations(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const operationIds = await Promise.all(Array.from({ length: 20 }, (_, i) =>
            manager.registerOperation(this.createOperation({
                type: i % 2 === 0 ? 'http_request' : 'file_transfer',
                criticalityLevel: 40 + (i % 50),
                estimatedDuration: 1000 + (i % 5000),
                startedAt: Date.now(),
                canInterrupt: true
            }))
        ));
        
        this.assert(operationIds.length === 20, 'Should handle many operations');
        this.assert(manager.activeOperations.length === 20, 'Should track all operations');
        
        // Завершаем все операции
        operationIds.forEach(id => manager.completeOperation(id));
        
        this.assert(manager.activeOperations.length === 0, 'Should complete all operations');
    }
    
    // === ТЕСТЫ EDGE CASES ===
    
    private async testDisabledManager(): Promise<void> {
        const disabledConfig = { ...testDelayedSwitchConfig, enabled: false };
        const manager = new ChannelSwitchManager(disabledConfig);
        
        try {
            await manager.requestSwitch(
                testVPNs[1]!,
                'user_request',
                'normal',
                60
            );
            this.assert(false, 'Should throw error when disabled');
        } catch (error) {
            this.assert((error as Error).message.includes('disabled'), 'Should indicate that manager is disabled');
        }
    }
    
    private async testInvalidCriticalityLevel(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        // Критичность ниже 0 должна быть нормализована
        const operationId1 = await manager.registerOperation(this.createOperation({
            type: 'http_request',
            criticalityLevel: -10
        }));
        
        const operation1 = manager.activeOperations.find(op => op.id === operationId1);
        this.assertNotNull(operation1, 'Should register operation with negative criticality');
        this.assert(operation1.criticalityLevel >= 0, 'Should normalize negative criticality to 0');
        
        // Критичность выше 100 должна быть нормализована
        const operationId2 = await manager.registerOperation(this.createOperation({
            type: 'http_request',
            criticalityLevel: 150
        }));
        
        const operation2 = manager.activeOperations.find(op => op.id === operationId2);
        this.assertNotNull(operation2, 'Should register operation with high criticality');
        this.assert(operation2.criticalityLevel <= 100, 'Should normalize high criticality to 100');
    }
    
    private async testZeroDurationOperation(): Promise<void> {
        const manager = new ChannelSwitchManager(testDelayedSwitchConfig);
        
        const operationId = await manager.registerOperation(this.createOperation({
            type: 'http_request',
            criticalityLevel: 60,
            estimatedDuration: 0
        }));
        
        const operation = manager.activeOperations.find(op => op.id === operationId);
        this.assertNotNull(operation, 'Should register operation with zero duration');
        
        const optimalTime = manager.getOptimalSwitchTime();
        const now = Date.now();
        
        // Операция с нулевой длительностью не должна влиять на время переключения
        this.assert(Math.abs(optimalTime - now) < 1000, 'Zero duration operation should not delay switching');
    }
    
    // === ОСНОВНОЙ МЕТОД ЗАПУСКА ТЕСТОВ ===
    
    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting ChannelSwitchManager Test Suite...\n');
        
        try {
            // Тесты конструктора и инициализации
            await this.runTest('Constructor', () => this.testConstructor());
            await this.runTest('Constructor Disabled', () => this.testConstructorDisabled());
            
            // Тесты регистрации операций
            await this.runTest('Register Operation', () => this.testRegisterOperation());
            await this.runTest('Register Operation With Defaults', () => this.testRegisterOperationWithDefaults());
            await this.runTest('Complete Operation', () => this.testCompleteOperation());
            await this.runTest('Complete Nonexistent Operation', () => this.testCompleteNonexistentOperation());
            await this.runTest('Operation Callback', () => this.testOperationCallback());
            
            // Тесты принятия решений
            await this.runTest('Get Switch Decision Immediate', () => this.testGetSwitchDecisionImmediate());
            await this.runTest('Get Switch Decision Delayed', () => this.testGetSwitchDecisionDelayed());
            await this.runTest('Get Switch Decision With Active Operations', () => this.testGetSwitchDecisionWithActiveOperations());
            await this.runTest('Get Switch Decision With Interruptible Operations', () => this.testGetSwitchDecisionWithInterruptibleOperations());
            await this.runTest('Get Optimal Switch Time', () => this.testGetOptimalSwitchTime());
            
            // Тесты запроса переключения
            await this.runTest('Request Switch', () => this.testRequestSwitch());
            await this.runTest('Request Immediate Switch', () => this.testRequestImmediateSwitch());
            await this.runTest('Request Delayed Switch', () => this.testRequestDelayedSwitch());
            await this.runTest('Cancel Switch', () => this.testCancelSwitch());
            await this.runTest('Cancel Nonexistent Switch', () => this.testCancelNonexistentSwitch());
            await this.runTest('Cancel Switch Event', () => this.testCancelSwitchEvent());
            
            // Тесты событий
            await this.runTest('Switch Scheduled Event', () => this.testSwitchScheduledEvent());
            await this.runTest('Switch Completed Event', () => this.testSwitchCompletedEvent());
            
            // Тесты производительности
            await this.runTest('Multiple Concurrent Switches', () => this.testMultipleConcurrentSwitches());
            await this.runTest('Many Operations', () => this.testManyOperations());
            
            // Тесты edge cases
            await this.runTest('Disabled Manager', () => this.testDisabledManager());
            await this.runTest('Invalid Criticality Level', () => this.testInvalidCriticalityLevel());
            await this.runTest('Zero Duration Operation', () => this.testZeroDurationOperation());
            
            this.printSummary();
            
            if (this.failedTests > 0) {
                throw new Error(`${this.failedTests} ChannelSwitchManager tests failed`);
            }
            
            logger.info('✅ All ChannelSwitchManager tests passed successfully!');
            
        } catch (error) {
            this.printSummary();
            logger.error('❌ ChannelSwitchManager test suite failed:', error);
            throw error;
        }
    }
}

// === ЭКСПОРТ И ЗАПУСК ===

export { ChannelSwitchManagerTestSuite };

// Запуск тестов, если скрипт вызван напрямую
if (require.main === module) {
    const testSuite = new ChannelSwitchManagerTestSuite();
    testSuite.runAllTests().catch(error => {
        logger.error('Fatal error in ChannelSwitchManager tests:', error);
        process.exit(1);
    });
}
