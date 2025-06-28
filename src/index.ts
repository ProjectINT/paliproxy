#!/usr/bin/env node

import { VPNManager } from './manager';
import { VPNRequester } from './requester';
import configManager from './config';
import { logger } from './utils';
import { AppConfig, RequestConfig, VPNConfig } from './types';

/**
 * Главный класс PaliVPN
 * Предоставляет простой интерфейс для работы с VPN и выполнения запросов
 */
export class PaliVPN {
    private vpnManager: VPNManager;
    private requester: VPNRequester;
    private config: AppConfig;
    private _isInitialized: boolean = false;

    constructor(config?: Partial<AppConfig>, vpnConfigs?: VPNConfig[]) {
        // Загружаем конфигурацию
        this.config = config ? { ...configManager.get(), ...config } : configManager.get();
        
        // Если переданы VPN конфигурации, добавляем их в конфиг
        if (vpnConfigs && vpnConfigs.length > 0) {
            this.config.vpnConfigs = vpnConfigs;
        }
        
        // Создаем менеджер VPN соединений
        this.vpnManager = new VPNManager(this.config);
        
        // Создаем HTTP клиент
        this.requester = new VPNRequester(this.config, this.vpnManager);
    }

    /**
     * Инициализация VPN клиента
     */
    async initialize(): Promise<void> {
        if (this._isInitialized) {
            return;
        }

        try {
            logger.info('Initializing PaliVPN client...');
            
            await this.vpnManager.initialize();
            await this.vpnManager.start();
            
            this._isInitialized = true;
            logger.info('PaliVPN client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize PaliVPN client:', error);
            throw error;
        }
    }

    /**
     * Выполнение HTTP запроса через VPN
     */
    async request(config: RequestConfig): Promise<Response> {
        if (!this._isInitialized) {
            await this.initialize();
        }

        return this.requester.request(config);
    }

    /**
     * Остановка VPN клиента
     */
    async stop(): Promise<void> {
        if (!this._isInitialized) {
            return;
        }

        try {
            logger.info('Stopping PaliVPN client...');
            await this.vpnManager.stop();
            this._isInitialized = false;
            logger.info('PaliVPN client stopped successfully');
        } catch (error) {
            logger.error('Failed to stop PaliVPN client:', error);
            throw error;
        }
    }

    /**
     * Получение статуса VPN соединения
     */
    get isConnected(): boolean {
        return this.vpnManager.currentVPN !== null;
    }

    /**
     * Получение текущего VPN
     */
    get currentVPN() {
        return this.vpnManager.currentVPN;
    }

    /**
     * Получение VPN менеджера для расширенного использования
     */
    get manager(): VPNManager {
        return this.vpnManager;
    }

    /**
     * Получение HTTP клиента для расширенного использования
     */
    get httpClient(): VPNRequester {
        return this.requester;
    }

    /**
     * Получение VPN менеджера для прямого доступа к функциям управления VPN
     */
    getVPNManager(): VPNManager {
        return this.vpnManager;
    }

    /**
     * Получение HTTP клиента для прямого доступа к функциям запросов
     */
    getRequester(): VPNRequester {
        return this.requester;
    }

    /**
     * Создание экземпляра PaliVPN с предопределенными VPN конфигурациями
     * Полезно для serverless функций, где не нужно читать файловую систему
     */
    static withVPNConfigs(vpnConfigs: VPNConfig[], config?: Partial<AppConfig>): PaliVPN {
        return new PaliVPN(config, vpnConfigs);
    }
}

/**
 * Основная точка входа в приложение (legacy)
 * Инициализирует VPN клиент с конфигурацией
 */
async function main(): Promise<void> {
    const client = new PaliVPN();
    
    try {
        await client.initialize();
        
        // Обработка сигналов для корректного завершения
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await client.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await client.stop();
            process.exit(0);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
        
    } catch (error) {
        logger.error('Failed to start PaliVPN client:', error);
        process.exit(1);
    }
}

// Запускаем приложение только если это основной модуль
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

// Экспорты для использования как библиотеки
export { main };
export { PaliVPN as default };
export { VPNManager } from './manager';
export { HealthChecker } from './healthChecker';
export { VPNRequester } from './requester';
export { configManager } from './config';
export { logger } from './utils';
export * from './types';
