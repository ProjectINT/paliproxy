#!/usr/bin/env node

import { VPNManager } from './manager';
import configManager from './config';
import { logger } from './utils';

/**
 * Основная точка входа в приложение
 * Инициализирует VPN клиент с конфигурацией
 */
async function main(): Promise<void> {
    try {
        logger.info('Starting PaliVPN client...');
        
        // Загружаем конфигурацию
        const vpnConfig = configManager.load();
        
        // Создаем менеджер VPN соединений
        const vpnManager = new VPNManager(vpnConfig);
        
        // Инициализируем и запускаем
        await vpnManager.initialize();
        await vpnManager.start();
        
        logger.info('PaliVPN client started successfully');
        
        // Обработка сигналов для корректного завершения
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await vpnManager.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await vpnManager.stop();
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
export { VPNManager } from './manager';
export { HealthChecker } from './healthChecker';
export { VPNRequester } from './requester';
export { configManager } from './config';
export { logger } from './utils';
export * from './types';
