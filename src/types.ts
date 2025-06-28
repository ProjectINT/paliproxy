import { EventEmitter } from 'events';

// Конфигурация VPN
export interface VPNConfig {
    name: string;
    config: string;
    priority: number;
    active: boolean;
    originalIP?: string;
    type?: 'openvpn' | 'wireguard' | 'ikev2';
    auth?: {
        username?: string;
        password?: string;
        certificate?: string;
        key?: string;
    };
}

// Основная конфигурация приложения
export interface AppConfig {
    vpnConfigsPath: string;
    defaultVpnTimeout: number;
    maxReconnectAttempts: number;
    healthCheckInterval: number;
    healthCheckUrl: string;
    healthCheckTimeout: number;
    httpTimeout: number;
    userAgent: string;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    nodeEnv: 'development' | 'production' | 'test';
    retryAttempts?: number;
    retryDelay?: number;
    vpnConfigs?: VPNConfig[]; // Предопределенные VPN конфигурации для serverless
}

// Результат проверки здоровья VPN
export interface HealthCheckResult {
    name: string;
    success: boolean;
    data?: any;
    error?: string;
    responseTime?: number;
}

// Статус здоровья VPN
export interface VPNHealthStatus {
    isHealthy: boolean;
    reason: string;
    successfulChecks: number;
    failedChecks: number;
    details: {
        successful: HealthCheckResult[];
        failed: Array<{
            check: string;
            reason: string;
        }>;
    };
    timestamp: string;
    duration?: number;
}

// Статус VPN Manager
export interface VPNManagerStatus {
    isRunning: boolean;
    currentVPN: VPNConfig | null;
    vpnList: VPNConfig[];
    reconnectAttempts: number;
}

// Статус Health Checker
export interface HealthCheckerStatus {
    isRunning: boolean;
    checkInterval: number;
    checkUrl: string;
    vpnCount: number;
    lastCheck?: string;
}

// Результат проверки связности
export interface ConnectivityResult {
    success: boolean;
    status?: number;
    duration: number;
    url: string;
    error?: string;
}

// Результат batch запроса
export interface BatchRequestResult {
    index: number;
    success: boolean;
    response?: any;
    status?: number;
    error?: string;
}

// Конфигурация HTTP запроса
export interface RequestConfig {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    timeout?: number;
    maxRedirects?: number;
}

// Информация о системе
export interface SystemInfo {
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
    nodeVersion: string;
    hostname: string;
}

// Результат выполнения команды
export interface ExecResult {
    stdout: string;
    stderr: string;
}

// События VPN Manager
export interface VPNManagerEvents {
    started: () => void;
    stopped: () => void;
    connected: (vpn: VPNConfig) => void;
    disconnected: (vpn: VPNConfig) => void;
    switched: (vpn: VPNConfig) => void;
    error: (error: Error) => void;
}

// События Health Checker
export interface HealthCheckerEvents {
    started: () => void;
    stopped: () => void;
    'vpn:healthy': (vpn: VPNConfig, status: VPNHealthStatus) => void;
    'vpn:unhealthy': (vpn: VPNConfig, status: VPNHealthStatus) => void;
}

// Интерфейс для VPN Manager
export interface IVPNManager extends EventEmitter {
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    connect(vpn: VPNConfig): Promise<void>;
    disconnect(): Promise<void>;
    switchVPN(vpn: VPNConfig): Promise<void>;
    connectToBestVPN(): Promise<void>;
    getStatus(): VPNManagerStatus;
    getConcurrencyStatus(): ConcurrencyStatus;
    readonly currentVPN: VPNConfig | null;
    readonly isRunning: boolean;
    readonly healthChecker: IHealthChecker;
}

// Интерфейс для Health Checker
export interface IHealthChecker extends EventEmitter {
    initialize(): Promise<void>;
    start(vpnList: VPNConfig[]): void;
    stop(): void;
    checkVPNHealth(vpn: VPNConfig): Promise<VPNHealthStatus>;
    checkOnce(vpn: VPNConfig): Promise<VPNHealthStatus>;
    getStatus(): HealthCheckerStatus;
}

// Интерфейс для HTTP Requester
export interface IVPNRequester {
    get(url: string, config?: RequestConfig, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Response>;
    post(url: string, data?: any, config?: RequestConfig, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Response>;
    put(url: string, data?: any, config?: RequestConfig, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Response>;
    delete(url: string, config?: RequestConfig): Promise<Response>;
    patch(url: string, data?: any, config?: RequestConfig): Promise<Response>;
    head(url: string, config?: RequestConfig): Promise<Response>;
    options(url: string, config?: RequestConfig): Promise<Response>;
    request(config: RequestConfig): Promise<Response>;
    getCurrentIP(): Promise<string>;
    checkConnectivity(url?: string, timeout?: number): Promise<ConnectivityResult>;
    requestWithVPNFallback(config: RequestConfig): Promise<Response>;
    batchRequests(requests: RequestConfig[], concurrency?: number): Promise<BatchRequestResult[]>;
    requestWithBuffering(config: RequestConfig, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Response>;
    getBufferStatus(): BufferStatus;
    clearBuffer(): void;
    stopBuffer(): void;
}

// Интерфейс для Config Manager
export interface IConfigManager {
    load(): AppConfig;
    get(): AppConfig;
    getValue<T = any>(key: string, defaultValue?: T): T;
    setValue(key: string, value: any): void;
}

// Интерфейс для Logger
export interface ILogger {
    setLevel(level: string): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}

// Опции для утилитарных функций
export interface RetryOptions {
    retries?: number;
    delay?: number;
    exponentialBackoff?: boolean;
}

export interface ThrottleOptions {
    limit: number;
}

export interface DebounceOptions {
    delay: number;
}

// Тип для обработчиков событий
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

// Типы для парсинга OVPN конфигурации
export interface OVPNConfig {
    [key: string]: string | boolean;
}

// HTTP Response wrapper
export interface HTTPResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
}

// Utility types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type VPNType = 'openvpn' | 'wireguard' | 'ikev2';
export type Environment = 'development' | 'production' | 'test';

// Типы для буферизации запросов
export interface BufferedRequest {
    id: string;
    config: RequestConfig;
    timestamp: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    retryCount: number;
    maxRetries: number;
    resolve: (value: Response) => void;
    reject: (reason: any) => void;
    timeout?: NodeJS.Timeout;
}

export interface RequestBuffer {
    readonly size: number;
    readonly maxSize: number;
    readonly isProcessing: boolean;
    add(request: BufferedRequest): boolean;
    process(): Promise<void>;
    clear(): void;
    getStatus(): BufferStatus;
}

export interface BufferStatus {
    queueSize: number;
    maxSize: number;
    isProcessing: boolean;
    totalProcessed: number;
    totalFailed: number;
    averageProcessingTime: number;
}

export interface BufferConfig {
    maxSize: number;
    processingInterval: number;
    maxRetries: number;
    timeoutMs: number;
    priorityWeights: {
        critical: number;
        high: number;
        normal: number;
        low: number;
    };
}

// Типы для управления конкурентностью и синхронизации
export interface ConcurrencyStatus {
    mutexes: {
        vpnSwitching: boolean;
        configLoading: boolean;
        healthChecking: boolean;
        requestProcessing: boolean;
    };
    semaphores: {
        maxConcurrentRequests: {
            available: number;
            total: number;
            queue: number;
        };
        maxVPNConnections: {
            available: number;
            total: number;
            queue: number;
        };
    };
    locks: {
        vpnList: {
            readers: number;
            writers: number;
            readQueue: number;
            writeQueue: number;
        };
    };
}
