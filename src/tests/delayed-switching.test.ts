/**
 * Простой тест системы отложенного переключения каналов
 */

import { ChannelSwitchManager } from '../channelSwitchManager';
import { VPNManager } from '../manager';
import { 
    DelayedSwitchConfig,
    VPNConfig,
    AppConfig
} from '../types';
import { logger } from '../utils';

// Тестовые VPN конфигурации
const testVPNs: VPNConfig[] = [
    {
        name: 'test-primary',
        config: './test/primary.ovpn',
        priority: 1,
        active: true,
        type: 'openvpn'
    },
    {
        name: 'test-backup',
        config: './test/backup.ovpn',
        priority: 2,
        active: false,
        type: 'openvpn'
    }
];

// Тестовая конфигурация отложенного переключения
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

// Тестовая конфигурация приложения
const testAppConfig: AppConfig & { delayedSwitch: DelayedSwitchConfig } = {
    vpnConfigsPath: './test',
    defaultVpnTimeout: 10000,
    maxReconnectAttempts: 2,
    healthCheckInterval: 10000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 5000,
    httpTimeout: 10000,
    userAgent: 'PaliVPN-Test/1.0',
    logLevel: 'info',
    nodeEnv: 'test',
    delayedSwitch: testDelayedSwitchConfig,
    vpnConfigs: testVPNs
};

/**
 * Тест 1: Базовая функциональность ChannelSwitchManager
 */
async function testChannelSwitchManagerBasics(): Promise<void> {
    logger.info('🧪 Test 1: ChannelSwitchManager Basic Functionality');
    
    const switchManager = new ChannelSwitchManager(testDelayedSwitchConfig);
    
    // Проверяем начальное состояние
    console.assert(switchManager.isEnabled === true, 'Switch manager should be enabled');
    console.assert(switchManager.pendingSwitches.length === 0, 'Should have no pending switches initially');
    console.assert(switchManager.activeOperations.length === 0, 'Should have no active operations initially');
    
    // Тестируем регистрацию операции
    const operationId = switchManager.registerOperation({
        type: 'http_request',
        criticalityLevel: 60,
        startedAt: Date.now(),
        estimatedDuration: 5000,
        canInterrupt: true
    });
    
    console.assert(typeof operationId === 'string', 'Operation ID should be a string');
    console.assert(switchManager.activeOperations.length === 1, 'Should have one active operation');
    
    // Тестируем запрос переключения
    const switchId = await switchManager.requestSwitch(
        testVPNs[1]!,
        'user_request',
        'normal',
        60
    );
    
    console.assert(typeof switchId === 'string', 'Switch ID should be a string');
    
    // Завершаем операцию
    switchManager.completeOperation(operationId);
    console.assert(switchManager.activeOperations.length === 0, 'Should have no active operations after completion');
    
    logger.info('✅ ChannelSwitchManager basic functionality test passed');
}

/**
 * Тест 2: Интеграция с VPNManager
 */
async function testVPNManagerIntegration(): Promise<void> {
    logger.info('🧪 Test 2: VPNManager Integration');
    
    const manager = new VPNManager(testAppConfig);
    
    try {
        await manager.initialize();
        
        // Проверяем, что отложенное переключение включено
        const status = manager.getDelayedSwitchStatus();
        console.assert(status.isEnabled === true, 'Delayed switching should be enabled');
        
        // Регистрируем операцию
        const operationId = await manager.registerOperation({
            type: 'file_transfer',
            criticalityLevel: 75,
            estimatedDuration: 3000,
            canInterrupt: false
        });
        
        console.assert(typeof operationId === 'string', 'Operation ID should be a string');
        
        // Запрашиваем переключение
        const switchId = await manager.requestDelayedSwitch(
            testVPNs[1]!,
            'optimization',
            'low',
            40
        );
        
        console.assert(typeof switchId === 'string', 'Switch ID should be a string');
        
        // Проверяем статус
        const statusAfterRequest = manager.getDelayedSwitchStatus();
        console.assert(statusAfterRequest.pendingSwitches.length > 0, 'Should have pending switches');
        console.assert(statusAfterRequest.activeOperations.length > 0, 'Should have active operations');
        
        // Отменяем переключение
        const cancelled = await manager.cancelDelayedSwitch(switchId);
        console.assert(cancelled === true, 'Switch should be cancellable');
        
        // Завершаем операцию
        await manager.completeOperation(operationId);
        
        const finalStatus = manager.getDelayedSwitchStatus();
        console.assert(finalStatus.activeOperations.length === 0, 'Should have no active operations after completion');
        
        logger.info('✅ VPNManager integration test passed');
        
    } finally {
        await manager.stop();
    }
}

/**
 * Тест 3: Различные уровни приоритета
 */
async function testPriorityLevels(): Promise<void> {
    logger.info('🧪 Test 3: Priority Levels');
    
    const switchManager = new ChannelSwitchManager(testDelayedSwitchConfig);
    
    // Тестируем решения для разных уровней критичности
    
    // Низкий приоритет - должен быть отложен
    const lowPriorityDecision = switchManager.getSwitchDecision(
        testVPNs[1]!,
        'optimization',
        'low'
    );
    console.assert(lowPriorityDecision.action === 'delayed', 'Low priority should be delayed');
    console.assert(lowPriorityDecision.delayMs > 0, 'Should have delay for low priority');
    
    // Высокий приоритет - должен быть быстрым
    const highPriorityDecision = switchManager.getSwitchDecision(
        testVPNs[1]!,
        'user_request',
        'high'
    );
    console.assert(['immediate', 'delayed'].includes(highPriorityDecision.action), 'High priority should be immediate or delayed');
    
    // Экстренный приоритет - должен быть немедленным
    const emergencyDecision = switchManager.getSwitchDecision(
        testVPNs[1]!,
        'emergency',
        'emergency'
    );
    console.assert(emergencyDecision.action === 'immediate', 'Emergency should be immediate');
    console.assert(emergencyDecision.delayMs === 0, 'Emergency should have no delay');
    
    logger.info('✅ Priority levels test passed');
}

/**
 * Тест 4: Критичные операции
 */
async function testCriticalOperations(): Promise<void> {
    logger.info('🧪 Test 4: Critical Operations');
    
    const switchManager = new ChannelSwitchManager(testDelayedSwitchConfig);
    
    // Регистрируем критичную операцию
    const criticalOp = switchManager.registerOperation({
        type: 'file_transfer',
        criticalityLevel: 90,
        startedAt: Date.now(),
        estimatedDuration: 10000,
        canInterrupt: false
    });
    
    // Запрашиваем переключение во время критичной операции
    const switchId = await switchManager.requestSwitch(
        testVPNs[1]!,
        'user_request',
        'normal',
        60
    );
    
    const decision = switchManager.getSwitchDecision(
        testVPNs[1]!,
        'user_request',
        'normal'
    );
    
    // Переключение должно быть отложено из-за критичной операции
    console.assert(decision.action === 'delayed', 'Switch should be delayed due to critical operation');
    
    // Завершаем критичную операцию
    switchManager.completeOperation(criticalOp);
    
    // Теперь оптимальное время переключения должно быть близко к текущему времени
    const optimalTime = switchManager.getOptimalSwitchTime();
    const now = Date.now();
    console.assert(Math.abs(optimalTime - now) < 5000, 'Optimal switch time should be soon after completing critical operation');
    
    logger.info('✅ Critical operations test passed');
}

/**
 * Запуск всех тестов
 */
async function runAllTests(): Promise<void> {
    logger.info('🧪 Starting Delayed Switching Tests...\n');
    
    try {
        await testChannelSwitchManagerBasics();
        await testVPNManagerIntegration();
        await testPriorityLevels();
        await testCriticalOperations();
        
        logger.info('\n✅ All tests passed successfully!');
    } catch (error) {
        logger.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Запуск тестов, если скрипт вызван напрямую
if (require.main === module) {
    runAllTests().catch(error => {
        logger.error('Fatal error in tests:', error);
        process.exit(1);
    });
}

export { runAllTests };
