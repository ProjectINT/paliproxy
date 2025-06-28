import * as path from 'path';
import * as fs from 'fs';
import { AppConfig } from './types';

/**
 * Модуль для загрузки и управления конфигурацией
 */
class ConfigManager {
    private config: AppConfig;
    private readonly defaultConfig: AppConfig = {
        // VPN настройки
        vpnConfigsPath: './configs',
        defaultVpnTimeout: 30000,
        maxReconnectAttempts: 3,
        
        // Health checking
        healthCheckInterval: 60000,
        healthCheckUrl: 'https://httpbin.org/ip',
        healthCheckTimeout: 10000,
        
        // HTTP настройки
        httpTimeout: 10000,
        userAgent: 'PaliVPN/1.0.0',
        
        // Logging
        logLevel: 'info',
        
        // Environment
        nodeEnv: 'development'
    };

    constructor(overrideConfig?: Partial<AppConfig>) {
        // Начинаем с дефолтных значений
        this.config = { ...this.defaultConfig };
        
        // Загружаем из environment переменных
        this.loadFromEnvironment();
        
        // Загружаем из config.json
        this.loadFromConfigFile();
        
        // Загружаем из аргументов командной строки
        this.loadFromCommandLineArgs();
        
        // Применяем переданный конфиг (наивысший приоритет)
        if (overrideConfig) {
            Object.assign(this.config, overrideConfig);
        }
    }

    /**
     * Загрузка из файла config.json в корне проекта
     */
    private loadFromConfigFile(): void {
        const configPath = path.join(process.cwd(), 'config.json');
        
        if (fs.existsSync(configPath)) {
            try {
                const fileContent = fs.readFileSync(configPath, 'utf8');
                const fileConfig = JSON.parse(fileContent) as Partial<AppConfig>;
                Object.assign(this.config, fileConfig);
            } catch (error) {
                console.warn(`Failed to load config from ${configPath}:`, (error as Error).message);
            }
        }
    }

    /**
     * Загрузка конфигурации из environment переменных
     */
    private loadFromEnvironment(): void {
        // VPN настройки
        if (process.env.PALIVPN_CONFIG_PATH) {
            this.config.vpnConfigsPath = process.env.PALIVPN_CONFIG_PATH;
        }
        if (process.env.PALIVPN_VPN_TIMEOUT) {
            this.config.defaultVpnTimeout = parseInt(process.env.PALIVPN_VPN_TIMEOUT, 10);
        }
        if (process.env.PALIVPN_MAX_RECONNECT_ATTEMPTS) {
            this.config.maxReconnectAttempts = parseInt(process.env.PALIVPN_MAX_RECONNECT_ATTEMPTS, 10);
        }
        
        // Health checking
        if (process.env.PALIVPN_HEALTH_CHECK_INTERVAL) {
            this.config.healthCheckInterval = parseInt(process.env.PALIVPN_HEALTH_CHECK_INTERVAL, 10);
        }
        if (process.env.PALIVPN_HEALTH_CHECK_URL) {
            this.config.healthCheckUrl = process.env.PALIVPN_HEALTH_CHECK_URL;
        }
        if (process.env.PALIVPN_HEALTH_CHECK_TIMEOUT) {
            this.config.healthCheckTimeout = parseInt(process.env.PALIVPN_HEALTH_CHECK_TIMEOUT, 10);
        }
        
        // HTTP настройки
        if (process.env.PALIVPN_HTTP_TIMEOUT) {
            this.config.httpTimeout = parseInt(process.env.PALIVPN_HTTP_TIMEOUT, 10);
        }
        if (process.env.PALIVPN_USER_AGENT) {
            this.config.userAgent = process.env.PALIVPN_USER_AGENT;
        }
        
        // Logging
        if (process.env.PALIVPN_LOG_LEVEL) {
            this.config.logLevel = process.env.PALIVPN_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
        }
        
        // Environment
        if (process.env.NODE_ENV) {
            this.config.nodeEnv = process.env.NODE_ENV as 'development' | 'production' | 'test';
        }
    }

    /**
     * Загрузка конфигурации из аргументов командной строки
     */
    private loadFromCommandLineArgs(): void {
        const args = process.argv.slice(2);
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];
            
            if (arg === '--config-path' && nextArg) {
                this.config.vpnConfigsPath = nextArg;
                i++; // Пропускаем следующий аргумент
            } else if (arg === '--log-level' && nextArg) {
                this.config.logLevel = nextArg as 'debug' | 'info' | 'warn' | 'error';
                i++;
            } else if (arg === '--health-check-url' && nextArg) {
                this.config.healthCheckUrl = nextArg;
                i++;
            } else if (arg === '--http-timeout' && nextArg) {
                const timeout = parseInt(nextArg, 10);
                if (!isNaN(timeout)) {
                    this.config.httpTimeout = timeout;
                }
                i++;
            } else if (arg === '--vpn-timeout' && nextArg) {
                const timeout = parseInt(nextArg, 10);
                if (!isNaN(timeout)) {
                    this.config.defaultVpnTimeout = timeout;
                }
                i++;
            }
        }
    }

    /**
     * Получение текущей конфигурации
     */
    get(): AppConfig {
        return this.config;
    }

    /**
     * Получение конкретного значения конфигурации
     */
    getValue<T = any>(key: string, defaultValue?: T): T {
        return (this.config as any)[key] !== undefined ? (this.config as any)[key] : (defaultValue as T);
    }
}

// Создаем единственный экземпляр менеджера конфигурации
export const configManager = new ConfigManager();

// Экспортируем класс для создания экземпляров с кастомными конфигурациями
export { ConfigManager };
export default configManager;
