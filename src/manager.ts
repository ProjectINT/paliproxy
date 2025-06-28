import { EventEmitter } from 'events';
import { 
    AppConfig, 
    VPNConfig, 
    VPNManagerStatus,
    IVPNManager,
    IHealthChecker
} from './types';
import { HealthChecker } from './healthChecker';
import { logger, delay } from './utils';

/**
 * Менеджер VPN соединений
 * Управляет подключением, переключением и мониторингом VPN туннелей
 */
export class VPNManager extends EventEmitter implements IVPNManager {
    private _currentVPN: VPNConfig | null = null;
    private vpnList: VPNConfig[] = [];
    private _healthChecker: IHealthChecker;
    private _isRunning: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number;

    constructor(private readonly config: AppConfig) {
        super();
        this.maxReconnectAttempts = config.maxReconnectAttempts || 3;
        this._healthChecker = new HealthChecker(config);
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
        
        logger.info(`Loaded ${this.vpnList.length} VPN configurations`);
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
        logger.info('Connecting to best available VPN...');
        
        // Сортируем VPN по приоритету
        const sortedVPNs = [...this.vpnList].sort((a, b) => a.priority - b.priority);
        
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
    }

    /**
     * Подключение к конкретному VPN
     */
    async connect(vpn: VPNConfig): Promise<void> {
        logger.info(`Connecting to VPN: ${vpn.name}`);
        
        // TODO: Реализовать фактическое подключение к VPN
        // Пока симулируем подключение
        await delay(2000);
        
        this._currentVPN = vpn;
        vpn.active = true;
        this.reconnectAttempts = 0;
        
        this.emit('connected', vpn);
        logger.info(`Connected to VPN: ${vpn.name}`);
    }

    /**
     * Отключение от текущего VPN
     */
    async disconnect(): Promise<void> {
        if (!this._currentVPN) {
            return;
        }
        
        logger.info(`Disconnecting from VPN: ${this._currentVPN.name}`);
        
        // TODO: Реализовать фактическое отключение от VPN
        await delay(1000);
        
        this._currentVPN.active = false;
        const disconnectedVPN = this._currentVPN;
        this._currentVPN = null;
        
        this.emit('disconnected', disconnectedVPN);
        logger.info(`Disconnected from VPN: ${disconnectedVPN.name}`);
    }

    /**
     * Переключение на другой VPN
     */
    async switchVPN(targetVPN: VPNConfig): Promise<void> {
        logger.info(`Switching to VPN: ${targetVPN.name}`);
        
        // Отключаемся от текущего VPN
        if (this._currentVPN) {
            await this.disconnect();
        }
        
        // Подключаемся к новому VPN
        await this.connect(targetVPN);
        
        this.emit('switched', targetVPN);
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
        if (vpn === this._currentVPN && this._isRunning) {
            logger.warn(`Current VPN ${vpn.name} is unhealthy, attempting to reconnect...`);
            
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
                        await this.connectToBestVPN();
                    }
                }
            }
        }
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
}
