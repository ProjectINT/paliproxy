/**
 * Полные тесты для HealthChecker
 */

import { EventEmitter } from 'events';
import { HealthChecker } from '../healthChecker';
import { 
    AppConfig, 
    VPNConfig, 
    VPNHealthStatus,
    HealthCheckResult,
    HealthCheckerStatus 
} from '../types';
import { logger, delay } from '../utils';

// === ТЕСТОВЫЕ ДАННЫЕ ===

const testAppConfig: AppConfig = {
    vpnConfigsPath: './test-configs',
    defaultVpnTimeout: 10000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 1000, // Быстрее для тестов
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 5000,
    httpTimeout: 10000,
    userAgent: 'PaliVPN-Test/1.0',
    logLevel: 'debug',
    nodeEnv: 'test'
};

const testVPNs: VPNConfig[] = [
    {
        name: 'test-vpn-1',
        config: 'client\nremote vpn1.example.com 1194',
        priority: 1,
        active: true,
        type: 'openvpn'
    },
    {
        name: 'test-vpn-2',
        config: '[Interface]\nPrivateKey = test',
        priority: 2,
        active: false,
        type: 'wireguard'
    }
];

// === МОКИ ===

class MockFetch {
    private responses: Map<string, { ok: boolean; status: number; json: any; delay?: number }> = new Map();
    private callCount = 0;
    private calls: Array<{ url: string; options?: any; timestamp: number }> = [];
    
    setResponse(url: string, response: { ok: boolean; status: number; json: any; delay?: number }): void {
        this.responses.set(url, response);
    }
    
    async fetch(url: string, options?: any): Promise<Response> {
        this.callCount++;
        this.calls.push({ url, options, timestamp: Date.now() });
        
        const mockResponse = this.responses.get(url);
        if (!mockResponse) {
            throw new Error(`No mock response configured for URL: ${url}`);
        }
        
        // Handle abort signal properly
        if (options?.signal) {
            const signal = options.signal as AbortSignal;
            if (signal.aborted) {
                throw new Error('AbortError: The operation was aborted');
            }
            
            // If we have a delay and it's longer than the signal might timeout, simulate abort
            if (mockResponse.delay) {
                const abortPromise = new Promise((_, reject) => {
                    const onAbort = () => {
                        reject(new Error('AbortError: The operation was aborted'));
                    };
                    signal.addEventListener('abort', onAbort);
                    
                    setTimeout(() => {
                        signal.removeEventListener('abort', onAbort);
                    }, (mockResponse.delay || 0) + 100);
                });
                
                const delayPromise = delay(mockResponse.delay);
                
                try {
                    await Promise.race([delayPromise, abortPromise]);
                } catch (error) {
                    throw error;
                }
            }
        } else if (mockResponse.delay) {
            await delay(mockResponse.delay);
        }
        
        return {
            ok: mockResponse.ok,
            status: mockResponse.status,
            statusText: mockResponse.ok ? 'OK' : 'Error',
            json: async () => mockResponse.json
        } as Response;
    }
    
    getCallCount(): number {
        return this.callCount;
    }
    
    getCalls(): Array<{ url: string; options?: any; timestamp: number }> {
        return [...this.calls];
    }
    
    reset(): void {
        this.callCount = 0;
        this.calls.length = 0;
        this.responses.clear();
    }
}

// === ТЕСТОВЫЙ SUITE ===

class HealthCheckerTestSuite {
    private totalTests = 0;
    private passedTests = 0;
    private failedTests = 0;
    private mockFetch = new MockFetch();
    
    constructor() {
        // Подменяем глобальный fetch
        (global as any).fetch = this.mockFetch.fetch.bind(this.mockFetch);
    }
    
    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        this.totalTests++;
        logger.info(`🧪 Running HealthChecker test: ${testName}`);
        
        // Сброс моков перед каждым тестом
        this.mockFetch.reset();
        
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
        logger.info(`\n=== HEALTHCHECKER TEST SUMMARY ===`);
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
        const healthChecker = new HealthChecker(testAppConfig);
        
        const status = healthChecker.getStatus();
        this.assert(status.isRunning === false, 'Should not be running initially');
        this.assert(status.checkInterval === testAppConfig.healthCheckInterval, 'Should have correct check interval');
        this.assert(status.checkUrl === testAppConfig.healthCheckUrl, 'Should have correct check URL');
        this.assert(status.vpnCount === 0, 'Should have no VPNs initially');
        this.assert(status.lastCheck === undefined, 'Should have no last check initially');
    }
    
    private async testInitialize(): Promise<void> {
        const healthChecker = new HealthChecker(testAppConfig);
        
        await healthChecker.initialize();
        
        // Инициализация должна пройти без ошибок
        this.assert(true, 'Initialize should complete without errors');
    }
    
    // === ТЕСТЫ ПРОВЕРКИ ЗДОРОВЬЯ ===
    
    private async testCheckVPNHealthSuccess(): Promise<void> {
        // Mock all endpoints that health checker will call
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        this.mockFetch.setResponse('https://google.com', {
            ok: true,
            status: 200,
            json: {}
        });
        
        this.mockFetch.setResponse('https://cloudflare.com', {
            ok: true,
            status: 200,
            json: {}
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const result = await healthChecker.checkVPNHealth(testVPNs[0]!);
        
        this.assert(result.isHealthy === true, 'VPN should be healthy');
        this.assert(result.reason === 'All checks passed', 'Should have success reason');
        this.assert(result.successfulChecks >= 2, 'Should have at least 2 successful checks');
        this.assert(result.failedChecks <= 2, 'Should have at most 2 failed checks'); // latency and ip_change might fail
        this.assert(result.details.successful.length >= 2, 'Should have at least 2 successful details');
        this.assert(typeof result.timestamp === 'string', 'Should have timestamp');
        this.assert(typeof result.duration === 'number', 'Should have duration');
    }
    
    private async testCheckVPNHealthFailure(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: false,
            status: 500,
            json: { error: 'Server error' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const result = await healthChecker.checkVPNHealth(testVPNs[0]!);
        
        this.assert(result.isHealthy === false, 'VPN should be unhealthy');
        this.assert(result.reason.includes('Failed checks'), 'Should have failure reason');
        this.assert(result.successfulChecks <= 2, 'Should have limited successful checks'); // some checks might still succeed
        this.assert(result.failedChecks >= 1, 'Should have at least 1 failed check');
        this.assert(result.details.failed.length >= 1, 'Should have at least 1 failed detail');
    }
    
    private async testCheckVPNHealthTimeout(): Promise<void> {
        // Make all endpoints timeout to ensure VPN is unhealthy
        const longDelay = testAppConfig.healthCheckTimeout + 1000;
        
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' },
            delay: longDelay
        });
        
        this.mockFetch.setResponse('https://google.com', {
            ok: true,
            status: 200,
            json: {},
            delay: longDelay
        });
        
        this.mockFetch.setResponse('https://cloudflare.com', {
            ok: true,
            status: 200,
            json: {},
            delay: longDelay
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const result = await healthChecker.checkVPNHealth(testVPNs[0]!);
        
        // When requests timeout, they should be considered failed
        this.assert(result.isHealthy === false, 'VPN should be unhealthy due to timeout');
        this.assert(result.reason.includes('Failed checks'), 'Should have failure reason');
        this.assert(result.failedChecks >= 2, 'Should have multiple failed checks due to timeout');
    }
    
    private async testCheckOnce(): Promise<void> {
        // Mock all endpoints that health checker will call
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        this.mockFetch.setResponse('https://google.com', {
            ok: true,
            status: 200,
            json: {}
        });
        
        this.mockFetch.setResponse('https://cloudflare.com', {
            ok: true,
            status: 200,
            json: {}
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const result = await healthChecker.checkOnce(testVPNs[0]!);
        
        this.assert(result.isHealthy === true, 'Single check should be healthy');
        this.assert(this.mockFetch.getCallCount() >= 2, 'Should make multiple requests for different checks');
        this.assert(typeof result.duration === 'number', 'Should have duration');
        this.assert(typeof result.timestamp === 'string', 'Should have timestamp');
    }
    
    // === ТЕСТЫ НЕПРЕРЫВНОГО МОНИТОРИНГА ===
    
    private async testStartStop(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        // Проверяем начальное состояние
        let status = healthChecker.getStatus();
        this.assert(status.isRunning === false, 'Should not be running initially');
        
        // Запускаем мониторинг
        const startPromise = this.waitForEvent(healthChecker, 'started');
        healthChecker.start(testVPNs);
        await startPromise;
        
        status = healthChecker.getStatus();
        this.assert(status.isRunning === true, 'Should be running after start');
        this.assert(status.vpnCount === testVPNs.length, 'Should track correct number of VPNs');
        
        // Ждем несколько проверок
        await delay(testAppConfig.healthCheckInterval * 2.5);
        
        // Останавливаем мониторинг
        const stopPromise = this.waitForEvent(healthChecker, 'stopped');
        healthChecker.stop();
        await stopPromise;
        
        status = healthChecker.getStatus();
        this.assert(status.isRunning === false, 'Should not be running after stop');
        
        // Проверяем, что были сделаны запросы
        this.assert(this.mockFetch.getCallCount() >= 2, 'Should make multiple health check requests');
    }
    
    private async testHealthyVPNEvents(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        // Подписываемся на события
        const healthyEvents: Array<{ vpn: VPNConfig; status: VPNHealthStatus }> = [];
        healthChecker.on('vpn:healthy', (vpn, status) => {
            healthyEvents.push({ vpn, status });
        });
        
        healthChecker.start([testVPNs[0]!]);
        
        // Ждем события о здоровом VPN
        await this.waitForEvent(healthChecker, 'vpn:healthy');
        
        healthChecker.stop();
        
        this.assert(healthyEvents.length >= 1, 'Should emit at least one healthy event');
        this.assert(healthyEvents[0]?.vpn === testVPNs[0], 'Should emit event for correct VPN');
        this.assert(healthyEvents[0]?.status.isHealthy === true, 'Should report VPN as healthy');
    }
    
    private async testUnhealthyVPNEvents(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: false,
            status: 500,
            json: { error: 'Server error' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        // Подписываемся на события
        const unhealthyEvents: Array<{ vpn: VPNConfig; status: VPNHealthStatus }> = [];
        healthChecker.on('vpn:unhealthy', (vpn, status) => {
            unhealthyEvents.push({ vpn, status });
        });
        
        healthChecker.start([testVPNs[0]!]);
        
        // Ждем события о нездоровом VPN
        await this.waitForEvent(healthChecker, 'vpn:unhealthy');
        
        healthChecker.stop();
        
        this.assert(unhealthyEvents.length >= 1, 'Should emit at least one unhealthy event');
        this.assert(unhealthyEvents[0]?.vpn === testVPNs[0], 'Should emit event for correct VPN');
        this.assert(unhealthyEvents[0]?.status.isHealthy === false, 'Should report VPN as unhealthy');
    }
    
    private async testMultipleVPNMonitoring(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        healthChecker.start(testVPNs);
        
        // Ждем несколько циклов проверки
        await delay(testAppConfig.healthCheckInterval * 2.5);
        
        healthChecker.stop();
        
        const status = healthChecker.getStatus();
        this.assert(status.vpnCount === testVPNs.length, 'Should monitor all VPNs');
        
        // Должно быть сделано достаточно запросов для всех VPN
        const expectedMinCalls = testVPNs.length * 2; // Минимум 2 цикла для каждого VPN
        this.assert(this.mockFetch.getCallCount() >= expectedMinCalls, 
                   `Should make at least ${expectedMinCalls} calls, got ${this.mockFetch.getCallCount()}`);
    }
    
    // === ТЕСТЫ ОШИБОК И EDGE CASES ===
    
    private async testNetworkError(): Promise<void> {
        // Настраиваем fetch чтобы выбрасывать ошибку сети
        this.mockFetch.fetch = async () => {
            throw new Error('Network error');
        };
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const result = await healthChecker.checkVPNHealth(testVPNs[0]!);
        
        this.assert(result.isHealthy === false, 'VPN should be unhealthy due to network error');
        this.assert(result.reason.includes('Failed checks'), 'Should have failure reason');
        this.assert(result.failedChecks >= 1, 'Should have failed checks');
        this.assert(result.details.failed.length >= 1, 'Should have failed details');
    }
    
    private async testEmptyVPNList(): Promise<void> {
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        // Запуск с пустым списком VPN не должен вызывать ошибок
        healthChecker.start([]);
        
        const status = healthChecker.getStatus();
        this.assert(status.vpnCount === 0, 'Should handle empty VPN list');
        
        healthChecker.stop();
    }
    
    private async testStopWithoutStart(): Promise<void> {
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        // Остановка без запуска не должна вызывать ошибок
        healthChecker.stop();
        
        const status = healthChecker.getStatus();
        this.assert(status.isRunning === false, 'Should remain not running');
    }
    
    private async testDoubleStart(): Promise<void> {
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' }
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        healthChecker.start(testVPNs);
        let status = healthChecker.getStatus();
        this.assert(status.isRunning === true, 'Should be running after first start');
        
        // Второй запуск должен корректно обрабатываться
        healthChecker.start(testVPNs);
        status = healthChecker.getStatus();
        this.assert(status.isRunning === true, 'Should still be running after second start');
        
        healthChecker.stop();
    }
    
    private async testInvalidConfig(): Promise<void> {
        const invalidConfig = { ...testAppConfig };
        invalidConfig.healthCheckUrl = 'invalid-url';
        
        const healthChecker = new HealthChecker(invalidConfig);
        await healthChecker.initialize();
        
        // Проверка с невалидным URL должна провалиться
        const result = await healthChecker.checkVPNHealth(testVPNs[0]!);
        
        this.assert(result.isHealthy === false, 'VPN should be unhealthy with invalid URL');
    }
    
    // === ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ ===
    
    private async testConcurrentChecks(): Promise<void> {
        // Mock all endpoints for concurrent checks
        this.mockFetch.setResponse(testAppConfig.healthCheckUrl, {
            ok: true,
            status: 200,
            json: { origin: '1.2.3.4' },
            delay: 50 // Small delay for concurrency test
        });
        
        this.mockFetch.setResponse('https://google.com', {
            ok: true,
            status: 200,
            json: {},
            delay: 50
        });
        
        this.mockFetch.setResponse('https://cloudflare.com', {
            ok: true,
            status: 200,
            json: {},
            delay: 50
        });
        
        const healthChecker = new HealthChecker(testAppConfig);
        await healthChecker.initialize();
        
        const startTime = Date.now();
        
        // Запускаем несколько проверок параллельно
        const promises = testVPNs.map(vpn => healthChecker.checkVPNHealth(vpn));
        const results = await Promise.all(promises);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.assert(results.length === testVPNs.length, 'Should complete all checks');
        
        // Проверяем что все тесты завершились в разумное время
        const maxReasonableTime = testVPNs.length * 1000 + 2000; // Generous timeout
        this.assert(duration < maxReasonableTime, `Concurrent checks should complete within reasonable time: ${duration}ms < ${maxReasonableTime}ms`);
        
        // Проверяем что получили результаты для всех VPN
        this.assert(results.every(r => typeof r.isHealthy === 'boolean'), 'All results should have health status');
        this.assert(results.every(r => typeof r.duration === 'number'), 'All results should have duration');
    }
    
    // === ОСНОВНОЙ МЕТОД ЗАПУСКА ТЕСТОВ ===
    
    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting HealthChecker Test Suite...\n');
        
        try {
            // Тесты конструктора и инициализации
            await this.runTest('Constructor', () => this.testConstructor());
            await this.runTest('Initialize', () => this.testInitialize());
            
            // Тесты проверки здоровья
            await this.runTest('Check VPN Health Success', () => this.testCheckVPNHealthSuccess());
            await this.runTest('Check VPN Health Failure', () => this.testCheckVPNHealthFailure());
            await this.runTest('Check VPN Health Timeout', () => this.testCheckVPNHealthTimeout());
            await this.runTest('Check Once', () => this.testCheckOnce());
            
            // Тесты непрерывного мониторинга
            await this.runTest('Start Stop', () => this.testStartStop());
            await this.runTest('Healthy VPN Events', () => this.testHealthyVPNEvents());
            await this.runTest('Unhealthy VPN Events', () => this.testUnhealthyVPNEvents());
            await this.runTest('Multiple VPN Monitoring', () => this.testMultipleVPNMonitoring());
            
            // Тесты ошибок и edge cases
            await this.runTest('Network Error', () => this.testNetworkError());
            await this.runTest('Empty VPN List', () => this.testEmptyVPNList());
            await this.runTest('Stop Without Start', () => this.testStopWithoutStart());
            await this.runTest('Double Start', () => this.testDoubleStart());
            await this.runTest('Invalid Config', () => this.testInvalidConfig());
            
            // Тесты производительности
            await this.runTest('Concurrent Checks', () => this.testConcurrentChecks());
            
            this.printSummary();
            
            if (this.failedTests > 0) {
                throw new Error(`${this.failedTests} HealthChecker tests failed`);
            }
            
            logger.info('✅ All HealthChecker tests passed successfully!');
            
        } catch (error) {
            this.printSummary();
            logger.error('❌ HealthChecker test suite failed:', error);
            throw error;
        }
    }
}

// === ЭКСПОРТ И ЗАПУСК ===

export { HealthCheckerTestSuite };

// Запуск тестов, если скрипт вызван напрямую
if (require.main === module) {
    const testSuite = new HealthCheckerTestSuite();
    testSuite.runAllTests().catch(error => {
        logger.error('Fatal error in HealthChecker tests:', error);
        process.exit(1);
    });
}
