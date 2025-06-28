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
        
        // Загружаем из config.json
        this.loadFromConfigFile();
        
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
