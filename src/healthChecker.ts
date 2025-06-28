import { EventEmitter } from 'events';
import { 
    AppConfig, 
    VPNConfig, 
    VPNHealthStatus, 
    HealthCheckResult, 
    HealthCheckerStatus,
    IHealthChecker 
} from './types';
import { logger, delay } from './utils';

/**
 * Класс для проверки доступности и здоровья VPN туннелей
 */
export class HealthChecker extends EventEmitter implements IHealthChecker {
    private readonly checkInterval: number;
    private readonly checkUrl: string;
    private readonly timeout: number;
    private readonly userAgent: string;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private vpnList: VPNConfig[] = [];

    constructor(private readonly config: AppConfig) {
        super();
        this.checkInterval = config.healthCheckInterval || 60000;
        this.checkUrl = config.healthCheckUrl || 'https://httpbin.org/ip';
        this.timeout = config.healthCheckTimeout || 10000;
        this.userAgent = config.userAgent || 'PaliVPN-HealthChecker/1.0.0';
    }

    /**
     * Инициализация health checker
     */
    async initialize(): Promise<void> {
        logger.info('Initializing Health Checker...');
        logger.info('Health Checker initialized');
    }

    /**
     * Запуск мониторинга здоровья VPN
     */
    start(vpnList: VPNConfig[] = []): void {
        if (this.isRunning) {
            logger.warn('Health Checker is already running');
            return;
        }
        
        this.vpnList = vpnList;
        this.isRunning = true;
        
        logger.info(`Starting Health Checker with interval: ${this.checkInterval}ms`);
        
        // Выполняем первую проверку сразу
        this.performHealthCheck();
        
        // Запускаем периодические проверки
        this.intervalId = setInterval(() => {
            this.performHealthCheck();
        }, this.checkInterval);
        
        this.emit('started');
    }

    /**
     * Остановка мониторинга
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        logger.info('Health Checker stopped');
        this.emit('stopped');
    }

    /**
     * Выполнение проверки здоровья для всех VPN
     */
    private async performHealthCheck(): Promise<void> {
        if (!this.isRunning || this.vpnList.length === 0) {
            return;
        }
        
        logger.debug('Performing health check...');
        
        const promises = this.vpnList.map(vpn => this.checkVPNHealth(vpn));
        
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error('Error during health check:', error);
        }
    }

    /**
     * Проверка здоровья конкретного VPN
     */
    async checkVPNHealth(vpn: VPNConfig): Promise<VPNHealthStatus> {
        const startTime = Date.now();
        
        try {
            logger.debug(`Checking health of VPN: ${vpn.name}`);
            
            // Выполняем основные проверки
            const results = await Promise.allSettled([
                this.checkConnectivity(vpn),
                this.checkIPChange(vpn),
                this.checkDNSResolution(vpn),
                this.checkLatency(vpn)
            ]);
            
            // Анализируем результаты
            const healthStatus = this.analyzeHealthResults(vpn, results);
            const duration = Date.now() - startTime;
            healthStatus.duration = duration;
            
            if (healthStatus.isHealthy) {
                logger.debug(`VPN ${vpn.name} is healthy (${duration}ms)`);
                this.emit('vpn:healthy', vpn, healthStatus);
            } else {
                logger.warn(`VPN ${vpn.name} is unhealthy: ${healthStatus.reason} (${duration}ms)`);
                this.emit('vpn:unhealthy', vpn, healthStatus);
            }
            
            return healthStatus;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Health check failed for VPN ${vpn.name} (${duration}ms):`, (error as Error).message);
            
            const healthStatus: VPNHealthStatus = {
                isHealthy: false,
                reason: `Health check error: ${(error as Error).message}`,
                duration,
                timestamp: new Date().toISOString(),
                successfulChecks: 0,
                failedChecks: 1,
                details: {
                    successful: [],
                    failed: [{ check: 'general', reason: (error as Error).message }]
                }
            };
            
            this.emit('vpn:unhealthy', vpn, healthStatus);
            return healthStatus;
        }
    }

    /**
     * Проверка базовой связности
     */
    private async checkConnectivity(vpn: VPNConfig): Promise<HealthCheckResult> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(this.checkUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': this.userAgent
                }
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            return {
                name: 'connectivity',
                success: response.ok,
                data,
                responseTime: Date.now()
            };
        } catch (error) {
            return {
                name: 'connectivity',
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Проверка смены IP адреса (что трафик идет через VPN)
     */
    private async checkIPChange(vpn: VPNConfig): Promise<HealthCheckResult> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            // Получаем текущий IP
            const response = await fetch(this.checkUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': this.userAgent
                }
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json() as { origin: string };
            const currentIP = data.origin;
            
            // Сравниваем с последним известным IP без VPN
            const isVPNIP = currentIP !== vpn.originalIP;
            
            return {
                name: 'ip_change',
                success: true,
                data: {
                    currentIP,
                    isVPNIP,
                    originalIP: vpn.originalIP
                }
            };
        } catch (error) {
            return {
                name: 'ip_change',
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Проверка разрешения DNS
     */
    private async checkDNSResolution(vpn: VPNConfig): Promise<HealthCheckResult> {
        try {
            const testDomains = ['google.com', 'cloudflare.com'];
            const results: Array<{ domain: string; success: boolean; responseTime?: number; error?: string }> = [];
            
            for (const domain of testDomains) {
                try {
                    const startTime = Date.now();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch(`https://${domain}`, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': this.userAgent
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    const duration = Date.now() - startTime;
                    
                    results.push({
                        domain,
                        success: true,
                        responseTime: duration
                    });
                } catch (error) {
                    results.push({
                        domain,
                        success: false,
                        error: (error as Error).message
                    });
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            
            return {
                name: 'dns_resolution',
                success: successCount > 0,
                data: {
                    results,
                    successRate: successCount / testDomains.length
                }
            };
        } catch (error) {
            return {
                name: 'dns_resolution',
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Проверка латентности
     */
    private async checkLatency(vpn: VPNConfig): Promise<HealthCheckResult> {
        try {
            const attempts = 3;
            const latencies: number[] = [];
            
            for (let i = 0; i < attempts; i++) {
                const startTime = Date.now();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                await fetch(this.checkUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': this.userAgent
                    }
                });
                
                clearTimeout(timeoutId);
                const latency = Date.now() - startTime;
                latencies.push(latency);
                
                if (i < attempts - 1) {
                    await delay(1000); // Пауза между попытками
                }
            }
            
            const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const maxLatency = Math.max(...latencies);
            const minLatency = Math.min(...latencies);
            
            return {
                name: 'latency',
                success: avgLatency < 10000, // Считаем нормальной латентность менее 10 секунд
                data: {
                    average: avgLatency,
                    min: minLatency,
                    max: maxLatency,
                    attempts: latencies
                }
            };
        } catch (error) {
            return {
                name: 'latency',
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Анализ результатов проверки здоровья
     */
    private analyzeHealthResults(vpn: VPNConfig, results: PromiseSettledResult<HealthCheckResult>[]): VPNHealthStatus {
        const failedChecks: Array<{ check: string; reason: string }> = [];
        const successfulChecks: HealthCheckResult[] = [];
        
        results.forEach((result, index) => {
            const checkNames = ['connectivity', 'ip_change', 'dns_resolution', 'latency'];
            const checkName = checkNames[index] || 'unknown';
            
            if (result.status === 'fulfilled' && result.value.success) {
                successfulChecks.push(result.value);
            } else {
                const failureReason = result.status === 'rejected' 
                    ? (result.reason as Error).message 
                    : result.value.error || 'Unknown error';
                
                failedChecks.push({
                    check: checkName,
                    reason: failureReason
                });
            }
        });
        
        // VPN считается здоровым, если прошла проверка связности и хотя бы еще одна проверка
        const connectivityPassed = successfulChecks.some(check => check.name === 'connectivity');
        const isHealthy = connectivityPassed && successfulChecks.length >= 2;
        
        return {
            isHealthy,
            reason: isHealthy ? 'All checks passed' : `Failed checks: ${failedChecks.map(f => f.check).join(', ')}`,
            successfulChecks: successfulChecks.length,
            failedChecks: failedChecks.length,
            details: {
                successful: successfulChecks,
                failed: failedChecks
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получение статуса health checker
     */
    getStatus(): HealthCheckerStatus {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            checkUrl: this.checkUrl,
            vpnCount: this.vpnList.length
        };
    }

    /**
     * Выполнение разовой проверки VPN
     */
    async checkOnce(vpn: VPNConfig): Promise<VPNHealthStatus> {
        return await this.checkVPNHealth(vpn);
    }
}
