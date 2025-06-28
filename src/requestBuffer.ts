import { EventEmitter } from 'events';
import { 
    BufferedRequest, 
    RequestBuffer as IRequestBuffer, 
    BufferStatus, 
    BufferConfig,
    RequestConfig
} from './types';
import { logger, generateId } from './utils';

/**
 * Буфер для управления очередью HTTP запросов во время переключения VPN
 * Обеспечивает приоритизацию и обработку запросов без потери данных
 */
export class RequestBuffer extends EventEmitter implements IRequestBuffer {
    private queue: BufferedRequest[] = [];
    private readonly _maxSize: number;
    private readonly processingInterval: number;
    private readonly maxRetries: number;
    private readonly timeoutMs: number;
    private readonly priorityWeights: Record<string, number>;
    
    private _isProcessing: boolean = false;
    private processingTimer: NodeJS.Timeout | null = null;
    private stats = {
        totalProcessed: 0,
        totalFailed: 0,
        processingTimes: [] as number[]
    };
    
    // Функция для выполнения HTTP запросов
    private executeRequest?: (config: RequestConfig) => Promise<Response>;

    constructor(config: BufferConfig, executeRequest?: (config: RequestConfig) => Promise<Response>) {
        super();
        this._maxSize = config.maxSize;
        this.processingInterval = config.processingInterval;
        this.maxRetries = config.maxRetries;
        this.timeoutMs = config.timeoutMs;
        this.priorityWeights = config.priorityWeights;
        if (executeRequest) {
            this.executeRequest = executeRequest;
        }
    }

    /**
     * Получение размера очереди
     */
    get size(): number {
        return this.queue.length;
    }

    /**
     * Получение максимального размера очереди
     */
    get maxSize(): number {
        return this._maxSize;
    }

    /**
     * Проверка, обрабатывается ли очередь
     */
    get isProcessing(): boolean {
        return this._isProcessing;
    }

    /**
     * Добавление запроса в буфер
     */
    add(request: BufferedRequest): boolean {
        if (this.queue.length >= this._maxSize) {
            logger.warn('Request buffer is full, dropping oldest low priority request');
            this.dropOldestLowPriorityRequest();
        }

        // Устанавливаем таймаут для запроса
        if (request.timeout) {
            clearTimeout(request.timeout);
        }

        request.timeout = setTimeout(() => {
            this.removeRequest(request.id);
            request.reject(new Error('Request timeout in buffer'));
        }, this.timeoutMs);

        this.queue.push(request);
        this.sortQueueByPriority();

        logger.debug(`Added request ${request.id} to buffer (queue size: ${this.queue.length})`);
        this.emit('requestAdded', request);

        return true;
    }

    /**
     * Создание буферизированного запроса
     */
    createBufferedRequest(
        config: RequestConfig,
        priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
        maxRetries?: number
    ): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            const bufferedRequest: BufferedRequest = {
                id: generateId(12),
                config,
                timestamp: Date.now(),
                priority,
                retryCount: 0,
                maxRetries: maxRetries || this.maxRetries,
                resolve,
                reject
            };

            if (!this.add(bufferedRequest)) {
                reject(new Error('Failed to add request to buffer'));
            }
        });
    }

    /**
     * Обработка очереди запросов
     */
    async process(): Promise<void> {
        if (this._isProcessing || this.queue.length === 0) {
            return;
        }

        this._isProcessing = true;
        logger.debug(`Starting buffer processing (${this.queue.length} requests)`);

        try {
            while (this.queue.length > 0) {
                const request = this.queue.shift();
                if (!request) {break;}

                await this.processRequest(request);
            }
        } catch (error) {
            logger.error('Error during buffer processing:', error);
        } finally {
            this._isProcessing = false;
            logger.debug('Buffer processing completed');
        }
    }

    /**
     * Запуск автоматической обработки
     */
    startAutoProcessing(): void {
        if (this.processingTimer) {
            return;
        }

        this.processingTimer = setInterval(() => {
            if (!this._isProcessing && this.queue.length > 0) {
                this.process().catch(error => {
                    logger.error('Auto-processing error:', error);
                });
            }
        }, this.processingInterval);

        logger.info(`Started auto-processing with interval: ${this.processingInterval}ms`);
    }

    /**
     * Остановка автоматической обработки
     */
    stopAutoProcessing(): void {
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
            this.processingTimer = null;
        }
    }

    /**
     * Очистка буфера
     */
    clear(): void {
        // Отклоняем все ожидающие запросы
        for (const request of this.queue) {
            if (request.timeout) {
                clearTimeout(request.timeout);
            }
            request.reject(new Error('Buffer cleared'));
        }

        this.queue = [];
        logger.info('Request buffer cleared');
        this.emit('bufferCleared');
    }

    /**
     * Получение статуса буфера
     */
    getStatus(): BufferStatus {
        const avgProcessingTime = this.stats.processingTimes.length > 0
            ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
            : 0;

        return {
            queueSize: this.queue.length,
            maxSize: this._maxSize,
            isProcessing: this._isProcessing,
            totalProcessed: this.stats.totalProcessed,
            totalFailed: this.stats.totalFailed,
            averageProcessingTime: avgProcessingTime
        };
    }

    /**
     * Обработка отдельного запроса
     */
    private async processRequest(request: BufferedRequest): Promise<void> {
        const startTime = Date.now();

        try {
            logger.debug(`Processing request ${request.id} (priority: ${request.priority})`);
            
            let response: Response;
            
            if (this.executeRequest) {
                // Используем переданную функцию выполнения запросов
                response = await this.executeRequest(request.config);
            } else {
                // Фолбэк - выполняем запрос напрямую
                const url = request.config.url || '';
                const fetchConfig: RequestInit = {
                    method: request.config.method || 'GET'
                };
                
                if (request.config.headers) {
                    fetchConfig.headers = request.config.headers;
                }
                
                if (request.config.body && (request.config.method === 'POST' || request.config.method === 'PUT' || request.config.method === 'PATCH')) {
                    if (typeof request.config.body === 'object') {
                        fetchConfig.body = JSON.stringify(request.config.body);
                        fetchConfig.headers = {
                            ...fetchConfig.headers,
                            'Content-Type': 'application/json'
                        };
                    } else {
                        fetchConfig.body = request.config.body;
                    }
                }
                
                response = await fetch(url, fetchConfig);
            }

            if (request.timeout) {
                clearTimeout(request.timeout);
            }

            request.resolve(response);
            
            const processingTime = Date.now() - startTime;
            this.updateStats(processingTime, true);
            
            logger.debug(`Request ${request.id} processed successfully in ${processingTime}ms`);
            this.emit('requestProcessed', request, response);

        } catch (error) {
            request.retryCount++;
            
            if (request.retryCount <= request.maxRetries) {
                logger.warn(`Request ${request.id} failed, retrying (${request.retryCount}/${request.maxRetries})`);
                
                // Возвращаем запрос в начало очереди для повторной попытки
                this.queue.unshift(request);
                return;
            }

            // Превышено количество попыток
            if (request.timeout) {
                clearTimeout(request.timeout);
            }

            request.reject(error);
            this.updateStats(Date.now() - startTime, false);
            
            logger.error(`Request ${request.id} failed after ${request.retryCount} attempts:`, error);
            this.emit('requestFailed', request, error);
        }
    }

    /**
     * Сортировка очереди по приоритету
     */
    private sortQueueByPriority(): void {
        this.queue.sort((a, b) => {
            const priorityA = this.priorityWeights[a.priority] || 0;
            const priorityB = this.priorityWeights[b.priority] || 0;
            
            // Сначала по приоритету, потом по времени создания
            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Высший приоритет первый
            }
            
            return a.timestamp - b.timestamp; // Старшие запросы первыми
        });
    }

    /**
     * Удаление самого старого запроса с низким приоритетом
     */
    private dropOldestLowPriorityRequest(): void {
        for (let i = this.queue.length - 1; i >= 0; i--) {
            const request = this.queue[i];
            if (request && request.priority === 'low') {
                this.queue.splice(i, 1);
                
                if (request.timeout) {
                    clearTimeout(request.timeout);
                }
                
                request.reject(new Error('Request dropped due to buffer overflow'));
                logger.warn(`Dropped low priority request ${request.id} due to buffer overflow`);
                return;
            }
        }

        // Если нет запросов с низким приоритетом, удаляем самый старый
        if (this.queue.length > 0) {
            const oldestRequest = this.queue.shift()!;
            
            if (oldestRequest.timeout) {
                clearTimeout(oldestRequest.timeout);
            }
            
            oldestRequest.reject(new Error('Request dropped due to buffer overflow'));
            logger.warn(`Dropped oldest request ${oldestRequest.id} due to buffer overflow`);
        }
    }

    /**
     * Удаление запроса по ID
     */
    private removeRequest(id: string): void {
        const index = this.queue.findIndex(req => req.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
    }

    /**
     * Обновление статистики
     */
    private updateStats(processingTime: number, success: boolean): void {
        if (success) {
            this.stats.totalProcessed++;
        } else {
            this.stats.totalFailed++;
        }

        this.stats.processingTimes.push(processingTime);
        
        // Ограничиваем размер массива времен обработки
        if (this.stats.processingTimes.length > 100) {
            this.stats.processingTimes = this.stats.processingTimes.slice(-50);
        }
    }
}
