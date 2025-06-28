#!/usr/bin/env node

import { PaliVPN } from '../src/index';
import { VPNConfig } from '../src/types';
import { logger, delay } from '../src/utils';

/**
 * Демонстрация системы буферизации запросов
 * Показывает, как запросы буферизуются во время переключения VPN
 */

async function demonstrateBuffering(): Promise<void> {
    // Создаем VPN конфигурации для тестирования
    const vpnConfigs: VPNConfig[] = [
        {
            name: 'primary-vpn',
            config: 'mock-config-1',
            priority: 1,
            active: false,
            type: 'openvpn'
        },
        {
            name: 'backup-vpn',
            config: 'mock-config-2',
            priority: 2,
            active: false,
            type: 'wireguard'
        }
    ];

    const client = PaliVPN.withVPNConfigs(vpnConfigs);

    try {
        logger.info('🚀 Starting PaliVPN buffering demo...');
        
        // Инициализируем клиент
        await client.initialize();
        
        // Получаем HTTP клиент
        const requester = client.httpClient;
        
        logger.info('📊 Initial buffer status:');
        console.log(JSON.stringify(requester.getBufferStatus(), null, 2));
        
        // Демонстрация 1: Обычные запросы с буферизацией
        logger.info('\n--- Demo 1: Buffered Requests ---');
        
        const requests = [
            requester.get('https://httpbin.org/delay/1', {}, 'high'),
            requester.post('https://httpbin.org/post', { test: 'data' }, {}, 'normal'),
            requester.get('https://httpbin.org/json', {}, 'low'),
            requester.get('https://httpbin.org/status/200', {}, 'critical')
        ];
        
        logger.info('🔄 Sending buffered requests...');
        const startTime = Date.now();
        
        try {
            const responses = await Promise.allSettled(requests);
            const successCount = responses.filter(r => r.status === 'fulfilled').length;
            const duration = Date.now() - startTime;
            
            logger.info(`✅ Completed ${successCount}/${responses.length} requests in ${duration}ms`);
            
            // Показываем статистику буфера
            logger.info('📊 Buffer statistics after processing:');
            console.log(JSON.stringify(requester.getBufferStatus(), null, 2));
            
        } catch (error) {
            logger.error('❌ Buffered requests failed:', (error as Error).message);
        }
        
        // Демонстрация 2: Переключение VPN во время буферизации
        logger.info('\n--- Demo 2: VPN Switching with Buffering ---');
        
        // Запускаем запросы в фоне
        const backgroundRequests = [
            requester.requestWithBuffering({ url: 'https://httpbin.org/delay/2' }, 'normal'),
            requester.requestWithBuffering({ url: 'https://httpbin.org/delay/1' }, 'high'),
            requester.requestWithBuffering({ url: 'https://httpbin.org/json' }, 'critical')
        ];
        
        logger.info('🔄 Starting background requests...');
        
        // Ждем немного и переключаем VPN
        await delay(500);
        
        logger.info('🔄 Switching VPN during request processing...');
        try {
            const backupVPN = vpnConfigs[1];
            if (backupVPN) {
                await client.manager.switchVPN(backupVPN);
                logger.info('✅ VPN switched successfully');
            }
        } catch {
            logger.warn('⚠️ VPN switch simulation (mock mode)');
        }
        
        // Ждем завершения фоновых запросов
        try {
            const bgResults = await Promise.allSettled(backgroundRequests);
            const bgSuccessCount = bgResults.filter(r => r.status === 'fulfilled').length;
            logger.info(`✅ Background requests completed: ${bgSuccessCount}/${bgResults.length}`);
        } catch (error) {
            logger.error('❌ Background requests error:', (error as Error).message);
        }
        
        // Демонстрация 3: Приоритизация запросов
        logger.info('\n--- Demo 3: Request Prioritization ---');
        
        // Отправляем запросы с разными приоритетами
        const priorityRequests = [
            { priority: 'low' as const, url: 'https://httpbin.org/delay/1' },
            { priority: 'critical' as const, url: 'https://httpbin.org/status/200' },
            { priority: 'normal' as const, url: 'https://httpbin.org/json' },
            { priority: 'high' as const, url: 'https://httpbin.org/headers' }
        ];
        
        logger.info('🎯 Sending requests with different priorities...');
        const priorityPromises = priorityRequests.map(req => 
            requester.requestWithBuffering({ url: req.url }, req.priority)
                .then(() => logger.info(`✅ ${req.priority.toUpperCase()} priority request completed`))
                .catch(error => logger.error(`❌ ${req.priority.toUpperCase()} priority request failed:`, error.message))
        );
        
        await Promise.allSettled(priorityPromises);
        
        // Финальная статистика
        logger.info('\n📊 Final buffer statistics:');
        console.log(JSON.stringify(requester.getBufferStatus(), null, 2));
        
        // Очистка
        logger.info('\n🧹 Cleaning up...');
        requester.clearBuffer();
        
        logger.info('✅ Buffering demo completed successfully!');
        
    } catch (error) {
        logger.error('❌ Demo failed:', (error as Error).message);
        throw error;
        
    } finally {
        try {
            await client.stop();
            logger.info('🛑 Client stopped');
        } catch (error) {
            logger.error('Error stopping client:', error);
        }
    }
}

/**
 * Обработка сигналов для корректного завершения
 */
function setupSignalHandlers(): void {
    process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
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
}

// Настраиваем обработчики сигналов
setupSignalHandlers();

// Запускаем демонстрацию
if (require.main === module) {
    demonstrateBuffering().catch(error => {
        logger.error('Unhandled error in buffering demo:', error);
        process.exit(1);
    });
}

export { demonstrateBuffering };
