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
                // TODO: Реализовать загрузку конфигураций из файлов
                // Пока используем mock данные
                this.vpnList = [
                    {
                        name: 'vpn1',
                        config: 'path/to/vpn1.ovpn',
                        priority: 1,
                        active: false
                    },
                    {
                        name: 'vpn2', 
                        config: 'path/to/vpn2.ovpn',
                        priority: 2,
                        active: false
                    }
                ];
                
                logger.info(`Loaded ${this.vpnList.length} VPN configurations from filesystem`);
            });
        });
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
            logger.info(`Connecting to VPN: ${vpn.name}`);
            
            // TODO: Реализовать фактическое подключение к VPN
            // Пока симулируем подключение
            await delay(2000);
            
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
            logger.info(`Connected to VPN: ${vpn.name}`);
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
            logger.info(`Disconnecting from VPN: ${currentVPN.name}`);
            
            // TODO: Реализовать фактическое отключение от VPN
            await delay(1000);
            
            // Обновляем состояние с защитой от race conditions
            await this.vpnListLock.runWithWriteLock(async () => {
                if (currentVPN) {
                    currentVPN.active = false;
                }
                this._currentVPN = null;
            });
            
            this.emit('disconnected', currentVPN);
            logger.info(`Disconnected from VPN: ${currentVPN.name}`);
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
}
