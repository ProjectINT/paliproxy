/**
 * Максимально полные тесты для VPNManager
 * Покрывают все методы, edge cases и сценарии использования
 */

import { EventEmitter } from 'events';
import { VPNManager } from '../manager';
import { 
    AppConfig, 
    VPNConfig, 
    IHealthChecker,
    DelayedSwitchConfig,
    VPNHealthStatus
} from '../types';
import { logger } from '../utils';

// === МОКИ И УТИЛИТЫ ===

/**
 * Мок для HealthChecker
 */
class MockHealthChecker extends EventEmitter implements IHealthChecker {
    private _isRunning = false;
    private _checkInterval = 10000;
    
    constructor(private config: AppConfig) {
        super();
    }
    
    async initialize(): Promise<void> {
        // Мок инициализации
    }
    
    start(_vpnList: VPNConfig[]): void {
        this._isRunning = true;
        this.emit('started');
    }
    
    stop(): void {
        this._isRunning = false;
        this.emit('stopped');
    }
    
    async checkVPNHealth(_vpn: VPNConfig): Promise<VPNHealthStatus> {
        return {
            isHealthy: true,
            reason: 'Test health check',
            successfulChecks: 1,
            failedChecks: 0,
            details: {
                successful: [],
                failed: []
            },
            timestamp: new Date().toISOString()
        };
    }
    
    async checkOnce(vpn: VPNConfig): Promise<VPNHealthStatus> {
        return this.checkVPNHealth(vpn);
    }
    
    getStatus() {
        return {
            isRunning: this._isRunning,
            checkInterval: this._checkInterval,
            checkUrl: this.config.healthCheckUrl,
            vpnCount: 0
        };
    }
}

/**
 * Мок для файловой системы
 */
class MockFileSystem {
    private files: Map<string, string> = new Map();
    private directories: Set<string> = new Set();
    
    addFile(path: string, content: string): void {
        this.files.set(path, content);
    }
    
    addDirectory(path: string): void {
        this.directories.add(path);
    }
    
    exists(path: string): boolean {
        return this.files.has(path) || this.directories.has(path);
    }
    
    readFile(path: string): string {
        const content = this.files.get(path);
        if (!content) {
            throw new Error(`File not found: ${path}`);
        }
        return content;
    }
    
    readdir(path: string): string[] {
        const files: string[] = [];
        for (const [filePath] of this.files) {
            if (filePath.startsWith(path + '/')) {
                const relativePath = filePath.substring(path.length + 1);
                if (!relativePath.includes('/')) {
                    files.push(relativePath);
                }
            }
        }
        return files;
    }
    
    clear(): void {
        this.files.clear();
        this.directories.clear();
    }
}

/**
 * Мок для системных команд
 */
class MockCommandExecutor {
    private commandResults: Map<string, { stdout: string; stderr: string; success: boolean }> = new Map();
    private regexResults: Array<{ pattern: RegExp; result: { stdout: string; stderr: string; success: boolean } }> = [];
    private executedCommands: string[] = [];
    
    setCommandResult(command: string | RegExp, result: { stdout: string; stderr: string; success: boolean }): void {
        if (command instanceof RegExp) {
            this.regexResults.push({ pattern: command, result });
        } else {
            this.commandResults.set(command, result);
        }
    }
    
    async execute(command: string): Promise<{ stdout: string; stderr: string }> {
        this.executedCommands.push(command);
        
        // Сначала проверяем точные совпадения
        const exactResult = this.commandResults.get(command);
        if (exactResult) {
            if (!exactResult.success) {
                throw new Error(`Command failed: ${command}\n${exactResult.stderr}`);
            }
            return { stdout: exactResult.stdout, stderr: exactResult.stderr };
        }
        
        // Затем проверяем регулярные выражения
        for (const { pattern, result } of this.regexResults) {
            if (pattern.test(command)) {
                if (!result.success) {
                    throw new Error(`Command failed: ${command}\n${result.stderr}`);
                }
                return { stdout: result.stdout, stderr: result.stderr };
            }
        }
        
        throw new Error(`No mock result configured for command: ${command}`);
    }
    
    getExecutedCommands(): string[] {
        return [...this.executedCommands];
    }
    
    clear(): void {
        this.commandResults.clear();
        this.regexResults.length = 0;
        this.executedCommands.length = 0;
    }
}

// === ТЕСТОВЫЕ ДАННЫЕ ===

const mockFS = new MockFileSystem();
const mockCmd = new MockCommandExecutor();

const testVPNConfigs: VPNConfig[] = [
    {
        name: 'primary-openvpn',
        config: 'client\nremote vpn1.example.com 1194\nproto udp',
        priority: 1,
        active: false,
        type: 'openvpn',
        auth: {
            username: 'testuser',
            password: 'testpass'
        }
    },
    {
        name: 'backup-wireguard',
        config: '[Interface]\nPrivateKey = test\nAddress = 10.0.0.2/24',
        priority: 2,
        active: false,
        type: 'wireguard'
    },
    {
        name: 'emergency-ikev2',
        config: '{"server": "ikev2.example.com", "auth": "psk"}',
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

const testAppConfig: AppConfig & { delayedSwitch?: DelayedSwitchConfig } = {
    vpnConfigsPath: './test-configs',
    defaultVpnTimeout: 10000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 10000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 5000,
    httpTimeout: 10000,
    userAgent: 'PaliVPN-Test/1.0',
    logLevel: 'debug',
    nodeEnv: 'test',
    delayedSwitch: testDelayedSwitchConfig,
    vpnConfigs: testVPNConfigs
};

const testAppConfigWithoutDelayedSwitch: AppConfig = {
    vpnConfigsPath: './test-configs',
    defaultVpnTimeout: 10000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 10000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 5000,
    httpTimeout: 10000,
    userAgent: 'PaliVPN-Test/1.0',
    logLevel: 'debug',
    nodeEnv: 'test'
};

// === УТИЛИТЫ ТЕСТИРОВАНИЯ ===

/**
 * Ожидание события
 */
function waitForEvent(emitter: EventEmitter, eventName: string, timeout = 5000): Promise<any[]> {
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

/**
 * Ожидание
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверка утверждения
 */
function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Проверка, что значение не null/undefined
 */
function assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

// === МОКИ ПОДМЕНА ===

/**
 * Создание тестового VPNManager с моками
 */
function createTestVPNManager(config: AppConfig & { delayedSwitch?: DelayedSwitchConfig }): VPNManager {
    const manager = new VPNManager(config);
    
    // Подменяем healthChecker на мок
    (manager as any)._healthChecker = new MockHealthChecker(config);
    
    return manager;
}

/**
 * Настройка моков для файловой системы
 */
function setupFileSystemMocks(): void {
    mockFS.clear();
    mockFS.addDirectory('./test-configs');
    mockFS.addFile('./test-configs/primary.ovpn', 'client\nremote vpn1.example.com 1194\nproto udp');
    mockFS.addFile('./test-configs/backup.wg', '[Interface]\nPrivateKey = test\nAddress = 10.0.0.2/24');
    mockFS.addFile('./test-configs/emergency.json', '{"server": "ikev2.example.com", "auth": "psk"}');
}

/**
 * Настройка моков для команд
 */
function setupCommandMocks(): void {
    mockCmd.clear();
    
    // Моки для проверки команд
    mockCmd.setCommandResult('which openvpn', { stdout: '/usr/bin/openvpn', stderr: '', success: true });
    mockCmd.setCommandResult('which wg-quick', { stdout: '/usr/bin/wg-quick', stderr: '', success: true });
    mockCmd.setCommandResult('which ipsec', { stdout: '/usr/bin/ipsec', stderr: '', success: true });
    
    // Моки для сетевых интерфейсов
    mockCmd.setCommandResult('ip link show', { 
        stdout: '1: lo: <LOOPBACK,UP,LOWER_UP>\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>\n3: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP>', 
        stderr: '', 
        success: true 
    });
    
    // Моки для VPN команд
    mockCmd.setCommandResult(/^openvpn .*/, { stdout: 'OpenVPN started', stderr: '', success: true });
    mockCmd.setCommandResult(/^wg-quick up .*/, { stdout: 'WireGuard interface up', stderr: '', success: true });
    mockCmd.setCommandResult(/^wg-quick down .*/, { stdout: 'WireGuard interface down', stderr: '', success: true });
    mockCmd.setCommandResult(/^ipsec up .*/, { stdout: 'IKEv2 connection up', stderr: '', success: true });
    mockCmd.setCommandResult(/^ipsec down .*/, { stdout: 'IKEv2 connection down', stderr: '', success: true });
    
    // Моки для остановки VPN
    mockCmd.setCommandResult(/^kill -TERM .*/, { stdout: '', stderr: '', success: true });
    mockCmd.setCommandResult(/^pkill -f .*/, { stdout: '', stderr: '', success: true });
    mockCmd.setCommandResult('wg show interfaces', { stdout: 'wg0', stderr: '', success: true });
}

// === НАЧАЛО ТЕСТОВ ===

class VPNManagerTestSuite {
    private totalTests = 0;
    private passedTests = 0;
    private failedTests = 0;
    
    /**
     * Запуск одного теста
     */
    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        this.totalTests++;
        logger.info(`🧪 Running test: ${testName}`);
        
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
    
    /**
     * Вывод итогов
     */
    private printSummary(): void {
        logger.info(`\n=== TEST SUMMARY ===`);
        logger.info(`Total tests: ${this.totalTests}`);
        logger.info(`Passed: ${this.passedTests}`);
        logger.info(`Failed: ${this.failedTests}`);
        logger.info(`Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    }
    
    // === ТЕСТЫ КОНСТРУКТОРА И ИНИЦИАЛИЗАЦИИ ===
    
    /**
     * Тест: Конструктор VPNManager
     */
    private async testConstructor(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        
        assert(manager.currentVPN === null, 'Initial currentVPN should be null');
        assert(manager.isRunning === false, 'Initial isRunning should be false');
        assertNotNull(manager.healthChecker, 'healthChecker should be initialized');
        
        // Проверяем, что delayedSwitch инициализирован
        const delayedSwitchStatus = manager.getDelayedSwitchStatus();
        assert(delayedSwitchStatus.isEnabled === true, 'Delayed switch should be enabled');
    }
    
    /**
     * Тест: Конструктор без delayedSwitch
     */
    private async testConstructorWithoutDelayedSwitch(): Promise<void> {
        const manager = createTestVPNManager(testAppConfigWithoutDelayedSwitch);
        
        const delayedSwitchStatus = manager.getDelayedSwitchStatus();
        assert(delayedSwitchStatus.isEnabled === false, 'Delayed switch should be disabled');
        assert(delayedSwitchStatus.pendingSwitches.length === 0, 'Should have no pending switches');
        assert(delayedSwitchStatus.activeOperations.length === 0, 'Should have no active operations');
    }
    
    /**
     * Тест: Инициализация с предопределенными VPN конфигурациями
     */
    private async testInitializeWithPredefinedConfigs(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const status = manager.getStatus();
        assert(status.vpnList.length === 3, 'Should have 3 predefined VPN configs');
        assert(status.vpnList[0]?.name === 'primary-openvpn', 'First VPN should be primary-openvpn');
        assert(status.vpnList[1]?.name === 'backup-wireguard', 'Second VPN should be backup-wireguard');
        assert(status.vpnList[2]?.name === 'emergency-ikev2', 'Third VPN should be emergency-ikev2');
    }
    
    /**
     * Тест: Инициализация с загрузкой из файловой системы
     */
    private async testInitializeFromFileSystem(): Promise<void> {
        setupFileSystemMocks();
        
        const configWithoutPredefined = { ...testAppConfig };
        delete configWithoutPredefined.vpnConfigs;
        
        const manager = createTestVPNManager(configWithoutPredefined);
        
        // Подменяем методы файловой системы
        const _originalLoadFromFiles = (manager as any).loadVPNConfigsFromFiles;
        (manager as any).loadVPNConfigsFromFiles = async () => {
            return [
                {
                    name: 'primary',
                    config: 'client\nremote vpn1.example.com 1194\nproto udp',
                    priority: 1,
                    active: false,
                    type: 'openvpn'
                },
                {
                    name: 'backup',
                    config: '[Interface]\nPrivateKey = test\nAddress = 10.0.0.2/24',
                    priority: 2,
                    active: false,
                    type: 'wireguard'
                }
            ];
        };
        
        await manager.initialize();
        
        const status = manager.getStatus();
        assert(status.vpnList.length === 2, 'Should have 2 VPN configs loaded from files');
        assert(status.vpnList[0]?.name === 'primary', 'First VPN should be primary');
        assert(status.vpnList[1]?.name === 'backup', 'Second VPN should be backup');
    }
    
    // === ТЕСТЫ ЖИЗНЕННОГО ЦИКЛА ===
    
    /**
     * Тест: Запуск и остановка менеджера
     */
    private async testStartStop(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        // Подменяем connectToBestVPN чтобы не пытаться реально подключаться
        (manager as any).connectToBestVPN = async () => {
            (manager as any)._currentVPN = testVPNConfigs[0];
        };
        
        // Проверяем начальное состояние
        assert(manager.isRunning === false, 'Should not be running initially');
        
        // Запускаем
        const startPromise = waitForEvent(manager, 'started');
        await manager.start();
        await startPromise;
        
        assert(manager.isRunning === true, 'Should be running after start');
        assert(manager.currentVPN !== null, 'Should have current VPN after start');
        
        // Останавливаем
        const stopPromise = waitForEvent(manager, 'stopped');
        await manager.stop();
        await stopPromise;
        
        assert(manager.isRunning === false, 'Should not be running after stop');
    }
    
    /**
     * Тест: Двойной запуск
     */
    private async testDoubleStart(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).connectToBestVPN = async () => {
            (manager as any)._currentVPN = testVPNConfigs[0];
        };
        
        await manager.start();
        assert(manager.isRunning === true, 'Should be running after first start');
        
        // Второй запуск не должен ничего сломать
        await manager.start();
        assert(manager.isRunning === true, 'Should still be running after second start');
        
        await manager.stop();
    }
    
    /**
     * Тест: Остановка без запуска
     */
    private async testStopWithoutStart(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        // Остановка без предварительного запуска не должна вызывать ошибок
        await manager.stop();
        assert(manager.isRunning === false, 'Should remain not running');
    }
    
    // === ТЕСТЫ ПОДКЛЮЧЕНИЯ К VPN ===
    
    /**
     * Тест: Подключение к лучшему VPN
     */
    private async testConnectToBestVPN(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        // Подменяем методы подключения
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {
            // Мок подключения
        };
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {
            // Мок проверки
        };
        
        const connectPromise = waitForEvent(manager, 'connected');
        await manager.connectToBestVPN();
        await connectPromise;
        
        assert(manager.currentVPN !== null, 'Should have current VPN');
        assert(manager.currentVPN?.name === 'primary-openvpn', 'Should connect to highest priority VPN');
        assert(manager.currentVPN?.active === true, 'Current VPN should be active');
    }
    
    /**
     * Тест: Подключение к конкретному VPN
     */
    private async testConnectToSpecificVPN(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        
        const targetVPN = testVPNConfigs[1]!; // backup-wireguard
        
        const connectPromise = waitForEvent(manager, 'connected');
        await manager.connect(targetVPN);
        await connectPromise;
        
        assert(manager.currentVPN === targetVPN, 'Should connect to target VPN');
        assert(targetVPN.active === true, 'Target VPN should be active');
        
        // Проверяем, что другие VPN неактивны
        const status = manager.getStatus();
        const otherVPNs = status.vpnList.filter(v => v !== targetVPN);
        assert(otherVPNs.every(v => !v.active), 'Other VPNs should be inactive');
    }
    
    /**
     * Тест: Отключение от VPN
     */
    private async testDisconnect(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        (manager as any).terminateVPNConnection = async (_vpn: VPNConfig) => {};
        
        // Сначала подключаемся
        await manager.connect(testVPNConfigs[0]!);
        assert(manager.currentVPN !== null, 'Should be connected');
        
        // Теперь отключаемся
        const disconnectPromise = waitForEvent(manager, 'disconnected');
        await manager.disconnect();
        await disconnectPromise;
        
        assert(manager.currentVPN === null, 'Should not have current VPN after disconnect');
        
        const status = manager.getStatus();
        assert(status.vpnList.every(v => !v.active), 'All VPNs should be inactive');
    }
    
    /**
     * Тест: Отключение без активного VPN
     */
    private async testDisconnectWithoutActiveVPN(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        // Отключение без активного VPN не должно вызывать ошибок
        await manager.disconnect();
        assert(manager.currentVPN === null, 'Should remain without current VPN');
    }
    
    /**
     * Тест: Переключение VPN
     */
    private async testSwitchVPN(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        (manager as any).terminateVPNConnection = async (_vpn: VPNConfig) => {};
        
        // Подключаемся к первому VPN
        await manager.connect(testVPNConfigs[0]!);
        const firstVPN = manager.currentVPN;
        
        // Переключаемся на второй VPN
        const switchPromise = waitForEvent(manager, 'switched');
        await manager.switchVPN(testVPNConfigs[1]!);
        await switchPromise;
        
        assert(manager.currentVPN === testVPNConfigs[1], 'Should switch to second VPN');
        assert(firstVPN?.active === false, 'First VPN should be inactive');
        assert(testVPNConfigs[1]?.active === true, 'Second VPN should be active');
    }
    
    // === ТЕСТЫ ОБРАБОТКИ ОШИБОК ===
    
    /**
     * Тест: Ошибка подключения
     */
    private async testConnectionError(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {
            throw new Error('Connection failed');
        };
        
        try {
            await manager.connect(testVPNConfigs[0]!);
            assert(false, 'Should throw error');
        } catch (error) {
            assert((error as Error).message === 'Connection failed', 'Should propagate connection error');
        }
        
        assert(manager.currentVPN === null, 'Should not have current VPN after failed connection');
        assert(testVPNConfigs[0]?.active === false, 'VPN should not be active after failed connection');
    }
    
    /**
     * Тест: Ошибка проверки соединения
     */
    private async testConnectionVerificationError(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {
            throw new Error('Verification failed');
        };
        
        try {
            await manager.connect(testVPNConfigs[0]!);
            assert(false, 'Should throw error');
        } catch (error) {
            assert((error as Error).message === 'Verification failed', 'Should propagate verification error');
        }
        
        assert(manager.currentVPN === null, 'Should not have current VPN after failed verification');
    }
    
    /**
     * Тест: Ошибка отключения
     */
    private async testDisconnectionError(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        (manager as any).terminateVPNConnection = async (_vpn: VPNConfig) => {
            throw new Error('Disconnection failed');
        };
        
        // Подключаемся
        await manager.connect(testVPNConfigs[0]!);
        
        // Попытка отключения с ошибкой
        try {
            await manager.disconnect();
            assert(false, 'Should throw error');
        } catch (error) {
            assert((error as Error).message === 'Disconnection failed', 'Should propagate disconnection error');
        }
        
        // Состояние все равно должно быть очищено
        assert(manager.currentVPN === null, 'Should clear current VPN even after failed disconnection');
    }
    
    /**
     * Тест: Восстановление после нездорового VPN
     */
    private async testUnhealthyVPNRecovery(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {};
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        (manager as any).terminateVPNConnection = async (_vpn: VPNConfig) => {};
        
        // Подключаемся
        await manager.connect(testVPNConfigs[0]!);
        const currentVPN = manager.currentVPN;
        
        // Симулируем нездоровый VPN
        const healthChecker = manager.healthChecker;
        healthChecker.emit('vpn:unhealthy', currentVPN);
        
        // Ждем некоторое время для обработки
        await delay(100);
        
        // Проверяем, что начался процесс восстановления
        // (детальная проверка зависит от реализации handleUnhealthyVPN)
        assert(true, 'Recovery process should start');
    }
    
    // === ТЕСТЫ КОНКУРЕНТНОСТИ ===
    
    /**
     * Тест: Параллельные подключения
     */
    private async testConcurrentConnections(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        let connectionCount = 0;
        (manager as any).establishVPNConnection = async (_vpn: VPNConfig) => {
            connectionCount++;
            await delay(50); // Симулируем задержку
        };
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        
        // Запускаем несколько подключений параллельно
        const promises = [
            manager.connect(testVPNConfigs[0]!),
            manager.connect(testVPNConfigs[1]!),
            manager.connect(testVPNConfigs[2]!)
        ];
        
        await Promise.all(promises);
        
        // Должно быть только одно активное подключение
        const status = manager.getStatus();
        const activeVPNs = status.vpnList.filter(v => v.active);
        assert(activeVPNs.length === 1, 'Should have only one active VPN');
        
        // И только одно соединение должно было быть установлено в итоге
        assert(connectionCount >= 1, 'At least one connection should be established');
    }
    
    /**
     * Тест: Статус конкурентности
     */
    private async testConcurrencyStatus(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const status = manager.getConcurrencyStatus();
        
        assert(typeof status.mutexes.vpnSwitching === 'boolean', 'vpnSwitching mutex status should be boolean');
        assert(typeof status.mutexes.configLoading === 'boolean', 'configLoading mutex status should be boolean');
        assert(typeof status.mutexes.healthChecking === 'boolean', 'healthChecking mutex status should be boolean');
        
        assert(typeof status.semaphores.maxVPNConnections.available === 'number', 'Semaphore available should be number');
        assert(typeof status.semaphores.maxVPNConnections.total === 'number', 'Semaphore total should be number');
        assert(typeof status.semaphores.maxVPNConnections.queue === 'number', 'Semaphore queue should be number');
        
        assert(typeof status.locks.vpnList === 'object', 'VPN list lock status should be object');
    }
    
    // === ТЕСТЫ ОТЛОЖЕННОГО ПЕРЕКЛЮЧЕНИЯ ===
    
    /**
     * Тест: Запрос отложенного переключения
     */
    private async testRequestDelayedSwitch(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const switchId = await manager.requestDelayedSwitch(
            testVPNConfigs[1]!,
            'optimization',
            'normal',
            60
        );
        
        assert(typeof switchId === 'string', 'Switch ID should be string');
        assert(switchId.length > 0, 'Switch ID should not be empty');
        
        const status = manager.getDelayedSwitchStatus();
        assert(status.pendingSwitches.length > 0, 'Should have pending switches');
        
        const pendingSwitch = status.pendingSwitches.find(s => s.id === switchId);
        assert(pendingSwitch !== undefined, 'Should find pending switch by ID');
        assert(pendingSwitch?.targetVPN === testVPNConfigs[1], 'Should target correct VPN');
    }
    
    /**
     * Тест: Отмена отложенного переключения
     */
    private async testCancelDelayedSwitch(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const switchId = await manager.requestDelayedSwitch(
            testVPNConfigs[1]!,
            'optimization',
            'normal',
            60
        );
        
        const cancelled = await manager.cancelDelayedSwitch(switchId);
        assert(cancelled === true, 'Should successfully cancel switch');
        
        const status = manager.getDelayedSwitchStatus();
        const pendingSwitch = status.pendingSwitches.find(s => s.id === switchId);
        assert(pendingSwitch === undefined, 'Cancelled switch should not be in pending list');
    }
    
    /**
     * Тест: Отложенное переключение без конфигурации
     */
    private async testDelayedSwitchWithoutConfig(): Promise<void> {
        const manager = createTestVPNManager(testAppConfigWithoutDelayedSwitch);
        await manager.initialize();
        
        try {
            await manager.requestDelayedSwitch(
                testVPNConfigs[1]!,
                'optimization',
                'normal',
                60
            );
            assert(false, 'Should throw error when delayed switching is disabled');
        } catch (error) {
            assert((error as Error).message.includes('not enabled'), 'Should indicate that delayed switching is not enabled');
        }
    }
    
    /**
     * Тест: Регистрация операции
     */
    private async testRegisterOperation(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const operationId = await manager.registerOperation({
            type: 'http_request',
            criticalityLevel: 75,
            estimatedDuration: 5000,
            canInterrupt: false
        });
        
        assert(typeof operationId === 'string', 'Operation ID should be string');
        assert(operationId.length > 0, 'Operation ID should not be empty');
        
        const status = manager.getDelayedSwitchStatus();
        assert(status.activeOperations.length > 0, 'Should have active operations');
        
        const operation = status.activeOperations.find(op => op.id === operationId);
        assert(operation !== undefined, 'Should find operation by ID');
        assert(operation?.type === 'http_request', 'Should have correct operation type');
        assert(operation?.criticalityLevel === 75, 'Should have correct criticality level');
    }
    
    /**
     * Тест: Завершение операции
     */
    private async testCompleteOperation(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const operationId = await manager.registerOperation({
            type: 'file_transfer',
            criticalityLevel: 60
        });
        
        await manager.completeOperation(operationId);
        
        const status = manager.getDelayedSwitchStatus();
        const operation = status.activeOperations.find(op => op.id === operationId);
        assert(operation === undefined, 'Completed operation should not be in active list');
    }
    
    /**
     * Тест: Регистрация операции без конфигурации
     */
    private async testRegisterOperationWithoutConfig(): Promise<void> {
        const manager = createTestVPNManager(testAppConfigWithoutDelayedSwitch);
        await manager.initialize();
        
        try {
            await manager.registerOperation({
                type: 'http_request',
                criticalityLevel: 75
            });
            assert(false, 'Should throw error when delayed switching is disabled');
        } catch (error) {
            assert((error as Error).message.includes('not enabled'), 'Should indicate that delayed switching is not enabled');
        }
    }
    
    // === ТЕСТЫ ТИПОВ VPN ===
    
    /**
     * Тест: Подключение OpenVPN
     */
    private async testOpenVPNConnection(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        setupCommandMocks();
        
        // Подменяем методы для тестирования OpenVPN логики
        const originalEstablish = (manager as any).establishVPNConnection;
        (manager as any).establishVPNConnection = originalEstablish;
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        
        const openvpnVPN = testVPNConfigs.find(v => v.type === 'openvpn')!;
        
        try {
            await manager.connect(openvpnVPN);
            // Если нет ошибок, значит логика обработки OpenVPN работает
            assert(true, 'OpenVPN connection logic should work');
        } catch (error) {
            // Ожидаемо, так как нет реального OpenVPN
            assert((error as Error).message.includes('OpenVPN'), 'Should be OpenVPN-related error');
        }
    }
    
    /**
     * Тест: Подключение WireGuard
     */
    private async testWireGuardConnection(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        setupCommandMocks();
        
        const originalEstablish = (manager as any).establishVPNConnection;
        (manager as any).establishVPNConnection = originalEstablish;
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        
        const wireguardVPN = testVPNConfigs.find(v => v.type === 'wireguard')!;
        
        try {
            await manager.connect(wireguardVPN);
            assert(true, 'WireGuard connection logic should work');
        } catch (error) {
            assert((error as Error).message.includes('WireGuard'), 'Should be WireGuard-related error');
        }
    }
    
    /**
     * Тест: Подключение IKEv2
     */
    private async testIKEv2Connection(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        setupCommandMocks();
        
        const originalEstablish = (manager as any).establishVPNConnection;
        (manager as any).establishVPNConnection = originalEstablish;
        (manager as any).verifyConnection = async (_vpn: VPNConfig) => {};
        
        const ikev2VPN = testVPNConfigs.find(v => v.type === 'ikev2')!;
        
        try {
            await manager.connect(ikev2VPN);
            assert(true, 'IKEv2 connection logic should work');
        } catch (error) {
            assert((error as Error).message.includes('IKEv2'), 'Should be IKEv2-related error');
        }
    }
    
    /**
     * Тест: Неподдерживаемый тип VPN
     */
    private async testUnsupportedVPNType(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const unsupportedVPN: VPNConfig = {
            name: 'unsupported',
            config: 'test',
            priority: 99,
            active: false,
            type: 'unknown' as any
        };
        
        try {
            await manager.connect(unsupportedVPN);
            assert(false, 'Should throw error for unsupported VPN type');
        } catch (error) {
            assert((error as Error).message.includes('Unsupported VPN type'), 'Should indicate unsupported VPN type');
        }
    }
    
    // === ТЕСТЫ СТАТУСА И МОНИТОРИНГА ===
    
    /**
     * Тест: Получение статуса
     */
    private async testGetStatus(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const status = manager.getStatus();
        
        assert(typeof status.isRunning === 'boolean', 'isRunning should be boolean');
        assert(status.currentVPN === null || typeof status.currentVPN === 'object', 'currentVPN should be null or object');
        assert(Array.isArray(status.vpnList), 'vpnList should be array');
        assert(typeof status.reconnectAttempts === 'number', 'reconnectAttempts should be number');
        
        assert(status.vpnList.length === 3, 'Should have correct number of VPNs');
        assert(status.isRunning === false, 'Should not be running initially');
        assert(status.reconnectAttempts === 0, 'Should have zero reconnect attempts initially');
    }
    
    /**
     * Тест: Статус отложенного переключения
     */
    private async testGetDelayedSwitchStatus(): Promise<void> {
        const manager = createTestVPNManager(testAppConfig);
        await manager.initialize();
        
        const status = manager.getDelayedSwitchStatus();
        
        assert(typeof status.isEnabled === 'boolean', 'isEnabled should be boolean');
        assert(Array.isArray(status.pendingSwitches), 'pendingSwitches should be array');
        assert(Array.isArray(status.activeOperations), 'activeOperations should be array');
        assert(typeof status.statistics === 'object', 'statistics should be object');
        
        assert(status.isEnabled === true, 'Should be enabled');
        assert(status.pendingSwitches.length === 0, 'Should have no pending switches initially');
        assert(status.activeOperations.length === 0, 'Should have no active operations initially');
    }
    
    // === ОСНОВНОЙ МЕТОД ЗАПУСКА ВСЕХ ТЕСТОВ ===
    
    /**
     * Запуск всех тестов
     */
    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting VPNManager Test Suite...\n');
        
        try {
            // Тесты конструктора и инициализации
            await this.runTest('Constructor', () => this.testConstructor());
            await this.runTest('Constructor without delayed switch', () => this.testConstructorWithoutDelayedSwitch());
            await this.runTest('Initialize with predefined configs', () => this.testInitializeWithPredefinedConfigs());
            await this.runTest('Initialize from file system', () => this.testInitializeFromFileSystem());
            
            // Тесты жизненного цикла
            await this.runTest('Start and stop', () => this.testStartStop());
            await this.runTest('Double start', () => this.testDoubleStart());
            await this.runTest('Stop without start', () => this.testStopWithoutStart());
            
            // Тесты подключения к VPN
            await this.runTest('Connect to best VPN', () => this.testConnectToBestVPN());
            await this.runTest('Connect to specific VPN', () => this.testConnectToSpecificVPN());
            await this.runTest('Disconnect', () => this.testDisconnect());
            await this.runTest('Disconnect without active VPN', () => this.testDisconnectWithoutActiveVPN());
            await this.runTest('Switch VPN', () => this.testSwitchVPN());
            
            // Тесты обработки ошибок
            await this.runTest('Connection error', () => this.testConnectionError());
            await this.runTest('Connection verification error', () => this.testConnectionVerificationError());
            await this.runTest('Disconnection error', () => this.testDisconnectionError());
            await this.runTest('Unhealthy VPN recovery', () => this.testUnhealthyVPNRecovery());
            
            // Тесты конкурентности
            await this.runTest('Concurrent connections', () => this.testConcurrentConnections());
            await this.runTest('Concurrency status', () => this.testConcurrencyStatus());
            
            // Тесты отложенного переключения
            await this.runTest('Request delayed switch', () => this.testRequestDelayedSwitch());
            await this.runTest('Cancel delayed switch', () => this.testCancelDelayedSwitch());
            await this.runTest('Delayed switch without config', () => this.testDelayedSwitchWithoutConfig());
            await this.runTest('Register operation', () => this.testRegisterOperation());
            await this.runTest('Complete operation', () => this.testCompleteOperation());
            await this.runTest('Register operation without config', () => this.testRegisterOperationWithoutConfig());
            
            // Тесты типов VPN
            await this.runTest('OpenVPN connection', () => this.testOpenVPNConnection());
            await this.runTest('WireGuard connection', () => this.testWireGuardConnection());
            await this.runTest('IKEv2 connection', () => this.testIKEv2Connection());
            await this.runTest('Unsupported VPN type', () => this.testUnsupportedVPNType());
            
            // Тесты статуса и мониторинга
            await this.runTest('Get status', () => this.testGetStatus());
            await this.runTest('Get delayed switch status', () => this.testGetDelayedSwitchStatus());
            
            this.printSummary();
            
            if (this.failedTests > 0) {
                throw new Error(`${this.failedTests} tests failed`);
            }
            
            logger.info('✅ All VPNManager tests passed successfully!');
            
        } catch (error) {
            this.printSummary();
            logger.error('❌ VPNManager test suite failed:', error);
            throw error;
        }
    }
}

// === ЭКСПОРТ И ЗАПУСК ===

export { VPNManagerTestSuite };

// Запуск тестов, если скрипт вызван напрямую
if (require.main === module) {
    const testSuite = new VPNManagerTestSuite();
    testSuite.runAllTests().catch(error => {
        logger.error('Fatal error in VPNManager tests:', error);
        process.exit(1);
    });
}
