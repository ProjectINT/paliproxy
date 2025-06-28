import { EventEmitter } from 'events';
import { 
    AppConfig, 
    VPNConfig, 
    VPNManagerStatus,
    IVPNManager,
    IHealthChecker,
    ConcurrencyStatus,
    DelayedSwitchConfig,
    DelayedSwitchStatus,
    SwitchReason,
    SwitchPriority,
    ActiveOperation
} from './types';
import { HealthChecker } from './healthChecker';
import { ChannelSwitchManager } from './channelSwitchManager';
import { logger, delay } from './utils';
import { AsyncMutex, AsyncSemaphore, AsyncReadWriteLock } from './concurrency';

/**
 * Менеджер VPN соединений
 * Управляет подключением, переключением и мониторингом VPN туннелей
 */
export class VPNManager extends EventEmitter implements IVPNManager {
    private _currentVPN: VPNConfig | null = null;
    private vpnList: VPNConfig[] = [];
    private _healthChecker: IHealthChecker;
    private _channelSwitchManager: ChannelSwitchManager | null = null;
    private _isRunning: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number;
    
    // Мьютексы для защиты критических операций
    private readonly vpnSwitchingMutex = new AsyncMutex();
    private readonly configLoadingMutex = new AsyncMutex();
    private readonly healthCheckingMutex = new AsyncMutex();
    
    // Семафоры для ограничения параллельных операций
    private readonly maxVPNConnections = new AsyncSemaphore(1); // Только одно подключение одновременно
    
    // ReadWrite блокировка для списка VPN
    private readonly vpnListLock = new AsyncReadWriteLock();

    constructor(private readonly config: AppConfig & { delayedSwitch?: DelayedSwitchConfig }) {
        super();
        this.maxReconnectAttempts = config.maxReconnectAttempts || 3;
        this._healthChecker = new HealthChecker(config);
        
        // Инициализируем менеджер отложенного переключения, если он настроен
        if (config.delayedSwitch) {
            this._channelSwitchManager = new ChannelSwitchManager(config.delayedSwitch);
            this.setupDelayedSwitchHandlers();
        }
    }

    /**
     * Получение текущего VPN
     */
    get currentVPN(): VPNConfig | null {
        return this._currentVPN;
    }

    /**
     * Проверка статуса работы
     */
    get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Получение health checker
     */
    get healthChecker(): IHealthChecker {
        return this._healthChecker;
    }

    /**
     * Настройка обработчиков событий отложенного переключения
     */
    private setupDelayedSwitchHandlers(): void {
        if (!this._channelSwitchManager) return;

        // Немедленное переключение
        this._channelSwitchManager.on('immediateSwitch', async (switchRequest) => {
            logger.info(`Executing immediate switch to ${switchRequest.targetVPN.name}`);
            try {
                await this.switchVPN(switchRequest.targetVPN);
                this._channelSwitchManager!.emit('switchCompleted', switchRequest.id, true);
            } catch (error) {
                logger.error(`Immediate switch failed:`, error);
                this._channelSwitchManager!.emit('switchCompleted', switchRequest.id, false);
            }
        });

        // Отложенное переключение
        this._channelSwitchManager.on('delayedSwitch', async (switchRequest) => {
            logger.info(`Executing delayed switch to ${switchRequest.targetVPN.name}`);
            try {
                await this.switchVPN(switchRequest.targetVPN);
                this._channelSwitchManager!.emit('switchCompleted', switchRequest.id, true);
            } catch (error) {
                logger.error(`Delayed switch failed:`, error);
                this._channelSwitchManager!.emit('switchCompleted', switchRequest.id, false);
            }
        });

        // Отмена переключения
        this._channelSwitchManager.on('switchCancelled', (switchId, reason) => {
            logger.info(`Switch ${switchId} cancelled: ${reason}`);
            this.emit('delayedSwitchCancelled', switchId, reason);
        });

        // Запланированное переключение
        this._channelSwitchManager.on('switchScheduled', (switchRequest) => {
            logger.info(`Switch to ${switchRequest.targetVPN.name} scheduled for ${new Date(switchRequest.scheduledAt)}`);
            this.emit('delayedSwitchScheduled', switchRequest);
        });
    }

    /**
     * Инициализация менеджера
     */
    async initialize(): Promise<void> {
        logger.info('Initializing VPN Manager...');
        
        // Загружаем список доступных VPN конфигураций
        await this.loadVPNConfigs();
        
        // Инициализируем health checker
        await this._healthChecker.initialize();
        
        // Подписываемся на события health checker
        this._healthChecker.on('vpn:healthy', (vpn: VPNConfig) => {
            logger.debug(`VPN ${vpn.name} is healthy`);
        });
        
        this._healthChecker.on('vpn:unhealthy', (vpn: VPNConfig) => {
            logger.warn(`VPN ${vpn.name} is unhealthy`);
            this.handleUnhealthyVPN(vpn);
        });
        
        logger.info('VPN Manager initialized successfully');
    }

    /**
     * Загрузка VPN конфигураций
     */
    private async loadVPNConfigs(): Promise<void> {
        return this.configLoadingMutex.runWithLock(async () => {
            return this.vpnListLock.runWithWriteLock(async () => {
                // Если VPN конфигурации переданы в config, используем их
                if (this.config.vpnConfigs && this.config.vpnConfigs.length > 0) {
                    this.vpnList = [...this.config.vpnConfigs];
                    logger.info(`Using ${this.vpnList.length} provided VPN configurations`);
                    return;
                }
                
                // Иначе загружаем из файловой системы (legacy режим)
                this.vpnList = await this.loadVPNConfigsFromFiles();
                
                logger.info(`Loaded ${this.vpnList.length} VPN configurations from filesystem`);
            });
        });
    }

    /**
     * Загрузка VPN конфигураций из файлов в директории
     */
    private async loadVPNConfigsFromFiles(): Promise<VPNConfig[]> {
        const configsPath = this.config.vpnConfigsPath || './configs';
        const vpnConfigs: VPNConfig[] = [];
        
        try {
            // Проверяем существование директории
            const fs = await import('fs/promises');
            const path = await import('path');
            
            if (!await fs.access(configsPath).then(() => true).catch(() => false)) {
                logger.warn(`VPN configs directory not found: ${configsPath}`);
                return [];
            }
            
            // Читаем файлы в директории
            const files = await fs.readdir(configsPath);
            const vpnFiles = files.filter(file => 
                file.endsWith('.ovpn') || 
                file.endsWith('.conf') || 
                file.endsWith('.wg') ||
                file.endsWith('.json')
            );
            
            logger.info(`Found ${vpnFiles.length} VPN config files in ${configsPath}`);
            
            for (let i = 0; i < vpnFiles.length; i++) {
                const file = vpnFiles[i];
                if (!file) continue;
                
                const filePath = path.join(configsPath, file);
                
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const fileName = path.parse(file).name;
                    
                    // Определяем тип VPN по расширению файла
                    let type: 'openvpn' | 'wireguard' | 'ikev2' = 'openvpn';
                    if (file.endsWith('.wg') || file.endsWith('.conf')) {
                        type = 'wireguard';
                    } else if (file.endsWith('.json')) {
                        // Попробуем распарсить JSON конфиг
                        try {
                            const jsonConfig = JSON.parse(content);
                            if (jsonConfig.type) {
                                type = jsonConfig.type;
                            }
                        } catch {
                            // Если не JSON, оставляем OpenVPN
                        }
                    }
                    
                    const vpnConfig: VPNConfig = {
                        name: fileName,
                        type: type,
                        config: content,
                        priority: i + 1, // Приоритет по порядку файлов
                        active: false
                    };
                    
                    vpnConfigs.push(vpnConfig);
                    logger.debug(`Loaded VPN config: ${fileName} (${type})`);
                    
                } catch (error) {
                    logger.warn(`Failed to load VPN config file ${file}:`, (error as Error).message);
                }
            }
            
            logger.info(`Successfully loaded ${vpnConfigs.length} VPN configurations from files`);
            return vpnConfigs;
            
        } catch (error) {
            logger.error(`Failed to load VPN configs from directory ${configsPath}:`, (error as Error).message);
            return [];
        }
    }

    /**
     * Запуск менеджера
     */
    async start(): Promise<void> {
        if (this._isRunning) {
            logger.warn('VPN Manager is already running');
            return;
        }
        
        this._isRunning = true;
        logger.info('Starting VPN Manager...');
        
        // Подключаемся к лучшему доступному VPN
        await this.connectToBestVPN();
        
        // Запускаем мониторинг
        this.startHealthChecking();
        
        this.emit('started');
    }

    /**
     * Остановка менеджера
     */
    async stop(): Promise<void> {
        if (!this._isRunning) {
            return;
        }
        
        this._isRunning = false;
        logger.info('Stopping VPN Manager...');
        
        // Останавливаем health checking
        this._healthChecker.stop();
        
        // Отключаемся от текущего VPN
        if (this._currentVPN) {
            await this.disconnect();
        }
        
        this.emit('stopped');
        logger.info('VPN Manager stopped');
    }

    /**
     * Подключение к лучшему доступному VPN
     */
    async connectToBestVPN(): Promise<void> {
        return this.vpnSwitchingMutex.runWithLock(async () => {
            logger.info('Connecting to best available VPN...');
            
            // Получаем список VPN с защитой от race conditions
            const sortedVPNs = await this.vpnListLock.runWithReadLock(async () => {
                return [...this.vpnList].sort((a, b) => a.priority - b.priority);
            });
            
            for (const vpn of sortedVPNs) {
                try {
                    await this.connect(vpn);
                    logger.info(`Successfully connected to VPN: ${vpn.name}`);
                    return;
                } catch (error) {
                    logger.warn(`Failed to connect to VPN ${vpn.name}:`, (error as Error).message);
                    continue;
                }
            }
            
            throw new Error('Failed to connect to any VPN');
        });
    }

    /**
     * Подключение к конкретному VPN
     */
    async connect(vpn: VPNConfig): Promise<void> {
        return this.maxVPNConnections.runWithPermit(async () => {
            logger.info(`Connecting to VPN: ${vpn.name} (type: ${vpn.type || 'openvpn'})`);
            
            try {
                // Отключаемся от текущего VPN если он есть
                if (this._currentVPN) {
                    await this.disconnect();
                }
                
                // Выполняем подключение в зависимости от типа VPN
                await this.establishVPNConnection(vpn);
                
                // Проверяем подключение
                await this.verifyConnection(vpn);
                
                // Обновляем состояние с защитой от race conditions
                await this.vpnListLock.runWithWriteLock(async () => {
                    // Деактивируем все другие VPN
                    for (const v of this.vpnList) {
                        if (v !== vpn) {
                            v.active = false;
                        }
                    }
                    
                    // Активируем текущий VPN
                    vpn.active = true;
                    this._currentVPN = vpn;
                    this.reconnectAttempts = 0;
                });
                
                this.emit('connected', vpn);
                logger.info(`Successfully connected to VPN: ${vpn.name}`);
                
            } catch (error) {
                logger.error(`Failed to connect to VPN ${vpn.name}:`, (error as Error).message);
                
                // Очищаем состояние при ошибке
                await this.vpnListLock.runWithWriteLock(async () => {
                    vpn.active = false;
                    if (this._currentVPN === vpn) {
                        this._currentVPN = null;
                    }
                });
                
                throw error;
            }
        });
    }

    /**
     * Отключение от текущего VPN
     */
    async disconnect(): Promise<void> {
        return this.maxVPNConnections.runWithPermit(async () => {
            if (!this._currentVPN) {
                return;
            }
            
            const currentVPN = this._currentVPN;
            logger.info(`Disconnecting from VPN: ${currentVPN.name} (type: ${currentVPN.type || 'openvpn'})`);
            
            try {
                // Отключаемся в зависимости от типа VPN
                await this.terminateVPNConnection(currentVPN);
                
                // Обновляем состояние с защитой от race conditions
                await this.vpnListLock.runWithWriteLock(async () => {
                    if (currentVPN) {
                        currentVPN.active = false;
                    }
                    this._currentVPN = null;
                });
                
                this.emit('disconnected', currentVPN);
                logger.info(`Successfully disconnected from VPN: ${currentVPN.name}`);
                
            } catch (error) {
                logger.error(`Failed to disconnect from VPN ${currentVPN.name}:`, (error as Error).message);
                
                // Все равно обновляем состояние
                await this.vpnListLock.runWithWriteLock(async () => {
                    if (currentVPN) {
                        currentVPN.active = false;
                    }
                    this._currentVPN = null;
                });
                
                throw error;
            }
        });
    }

    /**
     * Переключение на другой VPN
     */
    async switchVPN(targetVPN: VPNConfig): Promise<void> {
        return this.vpnSwitchingMutex.runWithLock(async () => {
            logger.info(`Switching to VPN: ${targetVPN.name}`);
            
            // Отключаемся от текущего VPN
            if (this._currentVPN) {
                await this.disconnect();
            }
            
            // Подключаемся к новому VPN
            await this.connect(targetVPN);
            
            this.emit('switched', targetVPN);
        });
    }

    /**
     * Запуск мониторинга здоровья VPN
     */
    private startHealthChecking(): void {
        if (this._currentVPN) {
            this._healthChecker.start([this._currentVPN]);
        }
    }

    /**
     * Обработка нездорового VPN
     */
    private async handleUnhealthyVPN(vpn: VPNConfig): Promise<void> {
        // Используем мьютекс чтобы избежать одновременной обработки сбоев
        return this.vpnSwitchingMutex.runWithLock(async () => {
            // Проверяем, что VPN все еще текущий (может измениться пока ждали блокировку)
            if (vpn !== this._currentVPN || !this._isRunning) {
                return;
            }
            
            logger.warn(`Current VPN ${vpn.name} is unhealthy, attempting recovery...`);
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                try {
                    await this.disconnect();
                    await delay(5000); // Ждем перед повторным подключением
                    await this.connect(vpn);
                } catch (error) {
                    logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, (error as Error).message);
                    
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        logger.error('Max reconnection attempts reached, switching to another VPN');
                        
                        // Используем отложенное переключение, если доступно
                        if (this._channelSwitchManager) {
                            const sortedVPNs = await this.vpnListLock.runWithReadLock(async () => {
                                return [...this.vpnList]
                                    .filter(v => v !== vpn)
                                    .sort((a, b) => a.priority - b.priority);
                            });
                            
                            if (sortedVPNs.length > 0) {
                                const targetVPN = sortedVPNs[0]!; // Safe because we checked length > 0
                                logger.info(`Requesting delayed switch to best alternative VPN: ${targetVPN.name}`);
                                
                                try {
                                    await this.requestDelayedSwitch(
                                        targetVPN,
                                        'health_check_failed',
                                        'high',
                                        80 // Высокий уровень критичности для health check failures
                                    );
                                } catch (delayedSwitchError) {
                                    logger.error('Failed to request delayed switch, falling back to immediate switch:', delayedSwitchError);
                                    await this.connectToBestVPN();
                                }
                            } else {
                                logger.error('No alternative VPN available');
                            }
                        } else {
                            // Fallback: немедленное переключение
                            await this.connectToBestVPN();
                        }
                    }
                }
            }
        });
    }

    /**
     * Получение текущего статуса
     */
    getStatus(): VPNManagerStatus {
        return {
            isRunning: this._isRunning,
            currentVPN: this._currentVPN,
            vpnList: [...this.vpnList],
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Получение статуса синхронизации и конкурентности
     */
    getConcurrencyStatus(): ConcurrencyStatus {
        return {
            mutexes: {
                vpnSwitching: this.vpnSwitchingMutex.isLocked(),
                configLoading: this.configLoadingMutex.isLocked(),
                healthChecking: this.healthCheckingMutex.isLocked(),
                requestProcessing: false // Этот мьютекс в RequestBuffer
            },
            semaphores: {
                maxConcurrentRequests: {
                    available: 0, // Это в RequestBuffer
                    total: 0,
                    queue: 0
                },
                maxVPNConnections: {
                    available: this.maxVPNConnections.getAvailablePermits(),
                    total: 1,
                    queue: this.maxVPNConnections.getQueueSize()
                }
            },
            locks: {
                vpnList: this.vpnListLock.getStatus()
            }
        };
    }

    /**
     * Запрос отложенного переключения VPN
     */
    async requestDelayedSwitch(
        targetVPN: VPNConfig, 
        reason: SwitchReason, 
        priority: SwitchPriority, 
        criticalityLevel: number = 50
    ): Promise<string> {
        if (!this._channelSwitchManager) {
            throw new Error('Delayed switching is not enabled. Configure delayedSwitch in VPNManager config.');
        }

        return this._channelSwitchManager.requestSwitch(targetVPN, reason, priority, criticalityLevel);
    }

    /**
     * Отмена отложенного переключения
     */
    async cancelDelayedSwitch(switchId: string): Promise<boolean> {
        if (!this._channelSwitchManager) {
            return false;
        }

        return this._channelSwitchManager.cancelSwitch(switchId);
    }

    /**
     * Регистрация активной операции
     */
    async registerOperation(operation: Partial<ActiveOperation>): Promise<string> {
        if (!this._channelSwitchManager) {
            throw new Error('Delayed switching is not enabled. Configure delayedSwitch in VPNManager config.');
        }
        
        const fullOperation: Omit<ActiveOperation, 'id'> = {
            type: operation.type || 'http_request',
            criticalityLevel: operation.criticalityLevel || 50,
            startedAt: operation.startedAt || Date.now(),
            estimatedDuration: operation.estimatedDuration || 5000,
            canInterrupt: operation.canInterrupt !== undefined ? operation.canInterrupt : true,
            ...(operation.onComplete && { onComplete: operation.onComplete }),
            ...(operation.onInterrupt && { onInterrupt: operation.onInterrupt })
        };

        return this._channelSwitchManager.registerOperation(fullOperation);
    }

    /**
     * Завершение операции
     */
    async completeOperation(operationId: string): Promise<void> {
        if (!this._channelSwitchManager) {
            return;
        }

        this._channelSwitchManager.completeOperation(operationId);
    }

    /**
     * Получение статуса системы отложенного переключения
     */
    getDelayedSwitchStatus(): DelayedSwitchStatus {
        if (!this._channelSwitchManager) {
            return {
                isEnabled: false,
                pendingSwitches: [],
                activeOperations: [],
                statistics: {
                    totalRequests: 0,
                    completedSwitches: 0,
                    cancelledSwitches: 0,
                    averageDelayMs: 0
                }
            };
        }

        const pendingSwitches = this._channelSwitchManager.pendingSwitches;
        const activeOperations = this._channelSwitchManager.activeOperations;
        const now = Date.now();

        // Находим ближайшее запланированное переключение
        const nextSwitch = pendingSwitches
            .filter(s => s.scheduledAt > now)
            .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];

        const status: DelayedSwitchStatus = {
            isEnabled: this._channelSwitchManager.isEnabled,
            pendingSwitches,
            activeOperations,
            statistics: {
                // TODO: Добавить статистику в ChannelSwitchManager
                totalRequests: pendingSwitches.length,
                completedSwitches: 0,
                cancelledSwitches: 0,
                averageDelayMs: 0
            }
        };

        if (nextSwitch) {
            status.nextScheduledSwitch = {
                id: nextSwitch.id,
                targetVPN: nextSwitch.targetVPN,
                scheduledAt: nextSwitch.scheduledAt,
                timeUntilSwitch: nextSwitch.scheduledAt - now
            };
        }

        return status;
    }

    /**
     * Установка VPN соединения в зависимости от типа
     */
    private async establishVPNConnection(vpn: VPNConfig): Promise<void> {
        const vpnType = vpn.type || 'openvpn';
        
        switch (vpnType) {
            case 'openvpn':
                await this.connectOpenVPN(vpn);
                break;
            case 'wireguard':
                await this.connectWireGuard(vpn);
                break;
            case 'ikev2':
                await this.connectIKEv2(vpn);
                break;
            default:
                throw new Error(`Unsupported VPN type: ${vpnType}`);
        }
    }

    /**
     * Подключение через OpenVPN
     */
    private async connectOpenVPN(vpn: VPNConfig): Promise<void> {
        const { commandExists, execWithTimeout, parseOVPNConfig, createTempFile, fileExists } = await import('./utils');
        
        // Проверяем наличие OpenVPN
        if (!commandExists('openvpn')) {
            throw new Error('OpenVPN client is not installed. Please install openvpn package.');
        }
        
        let configPath = vpn.config;
        let tempFile: string | null = null;
        
        try {
            // Если config содержит не путь к файлу, а содержимое конфигурации
            if (!fileExists(vpn.config) && vpn.config.includes('\n')) {
                tempFile = createTempFile('openvpn-config', '.ovpn');
                const fs = await import('fs');
                fs.writeFileSync(tempFile, vpn.config, 'utf8');
                configPath = tempFile;
                logger.debug(`Created temporary config file: ${tempFile}`);
            }
            
            // Парсим конфигурацию для проверки
            const config = parseOVPNConfig(configPath);
            if (!config) {
                throw new Error(`Failed to parse OpenVPN config: ${configPath}`);
            }
            
            // Формируем команду подключения
            const args = [
                '--config', configPath,
                '--daemon', `palivpn-${vpn.name}`,
                '--writepid', `/tmp/palivpn-${vpn.name}.pid`,
                '--log', `/tmp/palivpn-${vpn.name}.log`
            ];
            
            // Добавляем аутентификацию если есть
            if (vpn.auth?.username && vpn.auth?.password) {
                const authFile = createTempFile('openvpn-auth', '.txt');
                const fs = await import('fs');
                fs.writeFileSync(authFile, `${vpn.auth.username}\n${vpn.auth.password}`, 'utf8');
                args.push('--auth-user-pass', authFile);
            }
            
            const command = `openvpn ${args.join(' ')}`;
            logger.debug(`Executing OpenVPN command: ${command}`);
            
            // Запускаем OpenVPN
            await execWithTimeout(command, this.config.defaultVpnTimeout);
            
            // Ждем установления соединения
            await delay(3000);
            
            logger.info(`OpenVPN connection established for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`OpenVPN connection failed:`, error);
            throw new Error(`OpenVPN connection failed: ${(error as Error).message}`);
        } finally {
            // Очищаем временные файлы
            if (tempFile) {
                try {
                    const fs = await import('fs');
                    fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    logger.warn(`Failed to cleanup temp file ${tempFile}:`, cleanupError);
                }
            }
        }
    }

    /**
     * Подключение через WireGuard
     */
    private async connectWireGuard(vpn: VPNConfig): Promise<void> {
        const { commandExists, execWithTimeout, createTempFile, fileExists } = await import('./utils');
        
        // Проверяем наличие WireGuard
        if (!commandExists('wg-quick')) {
            throw new Error('WireGuard client is not installed. Please install wireguard-tools package.');
        }
        
        let configPath = vpn.config;
        let tempFile: string | null = null;
        
        try {
            // Если config содержит не путь к файлу, а содержимое конфигурации
            if (!fileExists(vpn.config) && vpn.config.includes('[Interface]')) {
                tempFile = createTempFile('wireguard-config', '.conf');
                const fs = await import('fs');
                fs.writeFileSync(tempFile, vpn.config, 'utf8');
                configPath = tempFile;
                logger.debug(`Created temporary WireGuard config file: ${tempFile}`);
            }
            
            // Запускаем WireGuard
            const command = `wg-quick up ${configPath}`;
            logger.debug(`Executing WireGuard command: ${command}`);
            
            await execWithTimeout(command, this.config.defaultVpnTimeout);
            
            logger.info(`WireGuard connection established for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`WireGuard connection failed:`, error);
            throw new Error(`WireGuard connection failed: ${(error as Error).message}`);
        } finally {
            // Очищаем временные файлы
            if (tempFile) {
                try {
                    const fs = await import('fs');
                    fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    logger.warn(`Failed to cleanup temp file ${tempFile}:`, cleanupError);
                }
            }
        }
    }

    /**
     * Подключение через IKEv2
     */
    private async connectIKEv2(vpn: VPNConfig): Promise<void> {
        const { commandExists, execWithTimeout } = await import('./utils');
        
        // Проверяем наличие strongSwan
        if (!commandExists('ipsec')) {
            throw new Error('IKEv2 client (strongSwan) is not installed. Please install strongswan package.');
        }
        
        try {
            // Запускаем IKEv2 соединение
            // Предполагаем, что конфигурация уже загружена в /etc/ipsec.conf
            const command = `ipsec up ${vpn.name}`;
            logger.debug(`Executing IKEv2 command: ${command}`);
            
            await execWithTimeout(command, this.config.defaultVpnTimeout);
            
            logger.info(`IKEv2 connection established for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`IKEv2 connection failed:`, error);
            throw new Error(`IKEv2 connection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Проверка установленного VPN соединения
     */
    private async verifyConnection(vpn: VPNConfig): Promise<void> {
        try {
            logger.debug(`Verifying VPN connection for ${vpn.name}`);
            
            // Проверяем сетевые интерфейсы
            const { execWithTimeout } = await import('./utils');
            
            const vpnType = vpn.type || 'openvpn';
            let interfaceFound = false;
            
            try {
                // Получаем список сетевых интерфейсов
                const { stdout } = await execWithTimeout('ip link show', 5000);
                
                switch (vpnType) {
                    case 'openvpn':
                        // OpenVPN обычно создает интерфейс tun0, tun1, etc.
                        interfaceFound = stdout.includes('tun') || stdout.includes('tap');
                        break;
                    case 'wireguard':
                        // WireGuard создает интерфейс wg0, wg1, etc.
                        interfaceFound = stdout.includes('wg');
                        break;
                    case 'ikev2':
                        // IKEv2 может использовать различные интерфейсы
                        interfaceFound = true; // Для IKEv2 используем другой способ проверки
                        break;
                }
                
            } catch (error) {
                logger.warn(`Could not check network interfaces:`, error);
                interfaceFound = true; // Продолжаем без проверки интерфейса
            }
            
            if (!interfaceFound) {
                throw new Error(`VPN interface not found for ${vpnType} connection`);
            }
            
            // Дополнительная проверка: пытаемся получить новый IP
            try {
                const response = await fetch('https://httpbin.org/ip', { 
                    signal: AbortSignal.timeout(10000) 
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json() as { origin: string };
                const newIP = data.origin;
                
                if (newIP && newIP !== vpn.originalIP) {
                    logger.debug(`IP changed from ${vpn.originalIP} to ${newIP} - VPN connection verified`);
                    
                    // Сохраняем новый IP
                    vpn.originalIP = newIP;
                } else {
                    logger.warn(`IP did not change after VPN connection. Current IP: ${newIP}`);
                }
                
            } catch (error) {
                logger.warn(`Could not verify IP change:`, error);
                // Не бросаем ошибку, так как это не критично
            }
            
            logger.info(`VPN connection verified for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`VPN connection verification failed:`, error);
            throw new Error(`VPN connection verification failed: ${(error as Error).message}`);
        }
    }

    /**
     * Корректное отключение VPN соединения в зависимости от типа
     */
    private async terminateVPNConnection(vpn: VPNConfig): Promise<void> {
        const vpnType = vpn.type || 'openvpn';
        
        switch (vpnType) {
            case 'openvpn':
                await this.disconnectOpenVPN(vpn);
                break;
            case 'wireguard':
                await this.disconnectWireGuard(vpn);
                break;
            case 'ikev2':
                await this.disconnectIKEv2(vpn);
                break;
            default:
                logger.warn(`Unknown VPN type for disconnect: ${vpnType}`);
                break;
        }
    }

    /**
     * Отключение OpenVPN
     */
    private async disconnectOpenVPN(vpn: VPNConfig): Promise<void> {
        try {
            const { execWithTimeout } = await import('./utils');
            const fs = await import('fs');
            
            const pidFile = `/tmp/palivpn-${vpn.name}.pid`;
            
            // Пытаемся найти процесс по PID файлу
            if (fs.existsSync(pidFile)) {
                try {
                    const pid = fs.readFileSync(pidFile, 'utf8').trim();
                    await execWithTimeout(`kill -TERM ${pid}`, 5000);
                    logger.debug(`Terminated OpenVPN process with PID ${pid}`);
                    
                    // Ждем завершения процесса
                    await delay(2000);
                    
                    // Удаляем PID файл
                    fs.unlinkSync(pidFile);
                } catch (error) {
                    logger.warn(`Failed to terminate OpenVPN via PID file:`, error);
                }
            }
            
            // Fallback: ищем процессы по имени
            try {
                await execWithTimeout(`pkill -f "palivpn-${vpn.name}"`, 5000);
                logger.debug(`Killed OpenVPN processes by name pattern`);
            } catch (error) {
                logger.debug(`No OpenVPN processes found to kill:`, error);
            }
            
            logger.info(`OpenVPN disconnection completed for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`OpenVPN disconnection failed:`, error);
            throw new Error(`OpenVPN disconnection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Отключение WireGuard
     */
    private async disconnectWireGuard(vpn: VPNConfig): Promise<void> {
        try {
            const { execWithTimeout, fileExists } = await import('./utils');
            
            let configPath = vpn.config;
            
            // Если это временный файл, нужно найти интерфейс по-другому
            if (!fileExists(vpn.config)) {
                // Пытаемся найти активный WireGuard интерфейс
                try {
                    const { stdout } = await execWithTimeout('wg show interfaces', 5000);
                    const interfaces = stdout.trim().split('\n').filter(line => line.trim());
                    
                    if (interfaces.length > 0) {
                        // Отключаем все найденные интерфейсы (упрощенный подход)
                        for (const iface of interfaces) {
                            try {
                                await execWithTimeout(`wg-quick down ${iface}`, 5000);
                                logger.debug(`Disconnected WireGuard interface: ${iface}`);
                            } catch (error) {
                                logger.warn(`Failed to disconnect WireGuard interface ${iface}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    logger.warn(`Could not find WireGuard interfaces:`, error);
                }
            } else {
                // Отключаем по файлу конфигурации
                await execWithTimeout(`wg-quick down ${configPath}`, 5000);
            }
            
            logger.info(`WireGuard disconnection completed for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`WireGuard disconnection failed:`, error);
            throw new Error(`WireGuard disconnection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Отключение IKEv2
     */
    private async disconnectIKEv2(vpn: VPNConfig): Promise<void> {
        try {
            const { execWithTimeout } = await import('./utils');
            
            // Отключаем IKEv2 соединение
            await execWithTimeout(`ipsec down ${vpn.name}`, 5000);
            
            logger.info(`IKEv2 disconnection completed for ${vpn.name}`);
            
        } catch (error) {
            logger.error(`IKEv2 disconnection failed:`, error);
            throw new Error(`IKEv2 disconnection failed: ${(error as Error).message}`);
        }
    }
}
