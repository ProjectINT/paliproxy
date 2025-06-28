import * as path from 'path';
import * as fs from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { AppConfig, IConfigManager, LogLevel } from './types';

dotenvConfig();

/**
 * Модуль для загрузки и управления конфигурацией
 */
class ConfigManager implements IConfigManager {
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

    constructor() {
        this.config = { ...this.defaultConfig };
    }

    /**
     * Загрузка конфигурации из различных источников
     * Приоритет: аргументы командной строки > переменные окружения > файл конфигурации > значения по умолчанию
     */
    load(): AppConfig {
        // Начинаем с дефолтных значений
        this.config = { ...this.defaultConfig };
        
        // Загружаем из переменных окружения
        this.loadFromEnv();
        
        // Загружаем из файла конфигурации (если существует)
        this.loadFromFile();
        
        // Загружаем из аргументов командной строки
        this.loadFromArgs();
        
        // Валидируем конфигурацию
        this.validate();
        
        return this.config;
    }

    /**
     * Загрузка из переменных окружения
     */
    private loadFromEnv(): void {
        const envMapping: Record<string, keyof AppConfig> = {
            'NODE_ENV': 'nodeEnv',
            'VPN_CONFIGS_PATH': 'vpnConfigsPath',
            'DEFAULT_VPN_TIMEOUT': 'defaultVpnTimeout', 
            'MAX_RECONNECT_ATTEMPTS': 'maxReconnectAttempts',
            'HEALTH_CHECK_INTERVAL': 'healthCheckInterval',
            'HEALTH_CHECK_URL': 'healthCheckUrl',
            'HEALTH_CHECK_TIMEOUT': 'healthCheckTimeout',
            'HTTP_TIMEOUT': 'httpTimeout',
            'USER_AGENT': 'userAgent',
            'LOG_LEVEL': 'logLevel'
        };

        Object.entries(envMapping).forEach(([envKey, configKey]) => {
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                // Преобразуем строковые значения в соответствующие типы
                (this.config as any)[configKey] = this.parseValue(envValue);
            }
        });
    }

    /**
     * Загрузка из файла конфигурации
     */
    private loadFromFile(): void {
        const configPaths = [
            path.join(process.cwd(), 'config.json'),
            path.join(process.cwd(), 'config.js'),
            path.join(process.cwd(), '.palivpnrc')
        ];

        for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
                try {
                    let fileConfig: Partial<AppConfig>;
                    
                    if (configPath.endsWith('.json')) {
                        const fileContent = fs.readFileSync(configPath, 'utf8');
                        fileConfig = JSON.parse(fileContent);
                    } else if (configPath.endsWith('.js')) {
                        fileConfig = require(configPath);
                    } else {
                        // .palivpnrc - простой формат key=value
                        const fileContent = fs.readFileSync(configPath, 'utf8');
                        fileConfig = this.parseRcFile(fileContent);
                    }
                    
                    Object.assign(this.config, fileConfig);
                    break;
                } catch (error) {
                    console.warn(`Failed to load config from ${configPath}:`, (error as Error).message);
                }
            }
        }
    }

    /**
     * Загрузка из аргументов командной строки
     */
    private loadFromArgs(): void {
        const args = process.argv.slice(2);
        const argMapping: Record<string, keyof AppConfig> = {
            '--config-path': 'vpnConfigsPath',
            '--timeout': 'defaultVpnTimeout',
            '--health-interval': 'healthCheckInterval',
            '--health-url': 'healthCheckUrl',
            '--log-level': 'logLevel',
            '--user-agent': 'userAgent'
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!arg) continue;
            
            const configKey = argMapping[arg];
            
            if (configKey && i + 1 < args.length && args[i + 1]) {
                (this.config as any)[configKey] = this.parseValue(args[i + 1]!);
                i++; // Пропускаем следующий аргумент (значение)
            }
        }
    }

    /**
     * Парсинг значения из строки в соответствующий тип
     */
    private parseValue(value: string): any {
        // Булевы значения
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // Числовые значения
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        
        // Строковые значения
        return value;
    }

    /**
     * Парсинг .palivpnrc файла
     */
    private parseRcFile(content: string): Partial<AppConfig> {
        const config: any = {};
        const lines = content.split('\n');
        
        lines.forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    config[key.trim()] = this.parseValue(value);
                }
            }
        });
        
        return config;
    }

    /**
     * Валидация конфигурации
     */
    private validate(): void {
        // Проверяем обязательные поля и их типы
        const validations = [
            { key: 'defaultVpnTimeout', type: 'number', min: 1000 },
            { key: 'healthCheckInterval', type: 'number', min: 5000 },
            { key: 'httpTimeout', type: 'number', min: 1000 },
            { key: 'maxReconnectAttempts', type: 'number', min: 1 },
            { key: 'logLevel', type: 'string', values: ['error', 'warn', 'info', 'debug'] }
        ];

        validations.forEach(validation => {
            const value = (this.config as any)[validation.key];
            
            if (validation.type === 'number') {
                if (typeof value !== 'number' || isNaN(value)) {
                    throw new Error(`Config ${validation.key} must be a valid number`);
                }
                if (validation.min && value < validation.min) {
                    throw new Error(`Config ${validation.key} must be at least ${validation.min}`);
                }
            }
            
            if (validation.type === 'string') {
                if (typeof value !== 'string') {
                    throw new Error(`Config ${validation.key} must be a string`);
                }
                if (validation.values && !validation.values.includes(value)) {
                    throw new Error(`Config ${validation.key} must be one of: ${validation.values.join(', ')}`);
                }
            }
        });

        // Проверяем доступность папки с конфигурациями VPN
        if (this.config.vpnConfigsPath && !fs.existsSync(this.config.vpnConfigsPath)) {
            console.warn(`VPN configs path does not exist: ${this.config.vpnConfigsPath}`);
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

    /**
     * Установка значения конфигурации
     */
    setValue(key: string, value: any): void {
        (this.config as any)[key] = value;
    }
}

// Создаем единственный экземпляр менеджера конфигурации
export const configManager = new ConfigManager();
export default configManager;
