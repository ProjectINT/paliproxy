import { 
    AppConfig, 
    RequestConfig, 
    ConnectivityResult, 
    BatchRequestResult,
    IVPNRequester,
    IVPNManager,
    HTTPResponse
} from './types';
import { logger } from './utils';

/**
 * HTTP клиент для выполнения запросов через активный VPN туннель
 */
export class VPNRequester implements IVPNRequester {
    private readonly timeout: number;
    private readonly userAgent: string;
    private readonly retryAttempts: number;
    private readonly retryDelay: number;

    constructor(
        private readonly config: AppConfig, 
        private readonly vpnManager: IVPNManager
    ) {
        this.timeout = config.httpTimeout || 10000;
        this.userAgent = config.userAgent || 'PaliVPN/1.0.0';
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000;
    }

    /**
     * Создание базового fetch запроса с настройками
     */
    private async createRequest(config: RequestConfig): Promise<Response> {
        this.ensureVPNConnection();

        const url = config.url || '';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const headers: Record<string, string> = {
                'User-Agent': this.userAgent,
                ...config.headers
            };

            // Добавляем информацию о текущем VPN в заголовки для отладки
            const currentVPN = this.vpnManager.currentVPN;
            if (currentVPN) {
                headers['X-VPN-Name'] = currentVPN.name;
            }

            const fetchConfig: RequestInit = {
                method: config.method || 'GET',
                headers,
                signal: controller.signal
            };

            // Добавляем body если есть данные
            if (config.body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
                if (typeof config.body === 'object') {
                    fetchConfig.body = JSON.stringify(config.body);
                    headers['Content-Type'] = 'application/json';
                } else {
                    fetchConfig.body = config.body;
                }
            }

            logger.debug(`Making HTTP request: ${config.method?.toUpperCase() || 'GET'} ${url}`);

            const response = await fetch(url, fetchConfig);
            
            clearTimeout(timeoutId);
            
            logger.debug(`HTTP response: ${response.status} ${url}`);
            
            return response;

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Выполнение запроса с автоматическими ретраями
     */
    private async requestWithRetry(config: RequestConfig): Promise<Response> {
        let lastError: Error;
        
        for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
            try {
                return await this.createRequest(config);
            } catch (error) {
                lastError = error as Error;
                
                if (attempt < this.retryAttempts && this.shouldRetry(error as Error)) {
                    logger.warn(
                        `Request failed, retrying (${attempt + 1}/${this.retryAttempts}): ${(error as Error).message}`
                    );
                    
                    // Ждем перед повторной попыткой
                    await this.delay(this.retryDelay * (attempt + 1));
                    
                    // Проверяем, активен ли еще VPN
                    if (!this.vpnManager.currentVPN) {
                        logger.error('No active VPN for retry');
                        throw new Error('No active VPN connection');
                    }
                } else {
                    break;
                }
            }
        }
        
        logger.error(`HTTP request failed after ${this.retryAttempts + 1} attempts: ${lastError!.message}`);
        throw lastError!;
    }

    /**
     * Определение, нужно ли повторить запрос
     */
    private shouldRetry(error: Error): boolean {
        // Повторяем сетевые ошибки, таймауты
        return (
            error.name === 'AbortError' ||         // Таймаут
            error.message.includes('ECONNRESET') ||   // Сброс соединения
            error.message.includes('ENOTFOUND') ||    // DNS ошибка
            error.message.includes('ECONNREFUSED')    // Отказ в соединении
        );
    }

    /**
     * Задержка в миллисекундах
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * GET запрос
     */
    async get(url: string, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'GET' });
    }

    /**
     * POST запрос
     */
    async post(url: string, data?: any, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'POST', body: data });
    }

    /**
     * PUT запрос
     */
    async put(url: string, data?: any, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'PUT', body: data });
    }

    /**
     * DELETE запрос
     */
    async delete(url: string, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'DELETE' });
    }

    /**
     * PATCH запрос
     */
    async patch(url: string, data?: any, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'PATCH', body: data });
    }

    /**
     * HEAD запрос
     */
    async head(url: string, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'HEAD' });
    }

    /**
     * OPTIONS запрос
     */
    async options(url: string, config: RequestConfig = {}): Promise<Response> {
        return this.requestWithRetry({ ...config, url, method: 'OPTIONS' });
    }

    /**
     * Общий метод для любого HTTP запроса
     */
    async request(config: RequestConfig): Promise<Response> {
        return this.requestWithRetry(config);
    }

    /**
     * Проверка наличия активного VPN соединения
     */
    private ensureVPNConnection(): void {
        if (!this.vpnManager.currentVPN) {
            throw new Error('No active VPN connection');
        }
        
        if (!this.vpnManager.isRunning) {
            throw new Error('VPN Manager is not running');
        }
    }

    /**
     * Получение информации о текущем IP адресе
     */
    async getCurrentIP(): Promise<string> {
        try {
            const response = await this.get('https://httpbin.org/ip');
            const data = await response.json() as { origin: string };
            return data.origin;
        } catch (error) {
            logger.error('Failed to get current IP:', (error as Error).message);
            throw error;
        }
    }

    /**
     * Проверка доступности URL
     */
    async checkConnectivity(url: string = 'https://httpbin.org/status/200', timeout: number = 5000): Promise<ConnectivityResult> {
        const startTime = Date.now();
        
        try {
            const response = await this.get(url, { timeout });
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                status: response.status,
                duration,
                url
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return {
                success: false,
                error: (error as Error).message,
                duration,
                url
            };
        }
    }

    /**
     * Выполнение запроса с автоматическим переключением VPN при неудаче
     */
    async requestWithVPNFallback(requestConfig: RequestConfig): Promise<Response> {
        const maxVPNAttempts = 3;
        let currentAttempt = 0;
        
        while (currentAttempt < maxVPNAttempts) {
            try {
                return await this.request(requestConfig);
            } catch (error) {
                currentAttempt++;
                
                if (currentAttempt >= maxVPNAttempts) {
                    logger.error('All VPN attempts failed for request');
                    throw error;
                }
                
                logger.warn(`Request failed, trying with different VPN (attempt ${currentAttempt}/${maxVPNAttempts})`);
                
                // Пытаемся переключиться на другой VPN
                try {
                    await this.vpnManager.connectToBestVPN();
                    await this.delay(2000); // Ждем стабилизации соединения
                } catch (vpnError) {
                    logger.error('Failed to switch VPN:', (vpnError as Error).message);
                    throw error; // Возвращаем оригинальную ошибку запроса
                }
            }
        }
        
        throw new Error('Unexpected error in VPN fallback');
    }

    /**
     * Batch запросы с контролем параллелизма
     */
    async batchRequests(requests: RequestConfig[], concurrency: number = 5): Promise<BatchRequestResult[]> {
        const results: BatchRequestResult[] = [];
        
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);
            
            const batchPromises = batch.map(async (requestConfig, index) => {
                try {
                    const response = await this.request(requestConfig);
                    const data = await response.json();
                    
                    return {
                        index: i + index,
                        success: true,
                        response: data,
                        status: response.status
                    };
                } catch (error) {
                    return {
                        index: i + index,
                        success: false,
                        error: (error as Error).message,
                        status: undefined
                    };
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(result => 
                result.status === 'fulfilled' ? result.value : {
                    index: -1,
                    success: false,
                    error: (result.reason as Error).message
                }
            ));
        }
        
        return results;
    }

    /**
     * Получение статуса requester
     */
    getStatus(): Record<string, any> {
        return {
            timeout: this.timeout,
            retryAttempts: this.retryAttempts,
            retryDelay: this.retryDelay,
            userAgent: this.userAgent,
            currentVPN: this.vpnManager.currentVPN?.name || 'none',
            vpnManagerRunning: this.vpnManager.isRunning
        };
    }
}
