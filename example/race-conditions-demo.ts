#!/usr/bin/env node

import { PaliVPN } from '../src/index';
import { VPNConfig } from '../src/types';
import { logger, delay } from '../src/utils';

/**
 * Демонстрация защиты от race conditions
 * Показывает, как мьютексы и семафоры предотвращают состояния гонки
 */

async function demonstrateRaceConditionProtection(): Promise<void> {
    // Создаем VPN конфигурации для тестирования
    const vpnConfigs: VPNConfig[] = [
        {
            name: 'vpn-alpha',
            config: 'mock-config-alpha',
            priority: 1,
            active: false,
            type: 'openvpn'
        },
        {
            name: 'vpn-beta',
            config: 'mock-config-beta',
            priority: 2,
            active: false,
            type: 'wireguard'
        },
        {
            name: 'vpn-gamma',
            config: 'mock-config-gamma',
            priority: 3,
            active: false,
            type: 'ikev2'
        }
    ];

    const client = PaliVPN.withVPNConfigs(vpnConfigs);

    try {
        logger.info('🚀 Starting race condition protection demo...');
        
        // Инициализируем клиент
        await client.initialize();
        
        const manager = client.manager;
        const requester = client.httpClient;
        
        // Демонстрация 1: Множественные одновременные переключения VPN
        logger.info('\n--- Demo 1: Concurrent VPN Switching Protection ---');
        
        logger.info('📊 Initial concurrency status:');
        console.log(JSON.stringify(manager.getConcurrencyStatus(), null, 2));
        
        // Пытаемся одновременно переключиться на разные VPN
        const switchPromises = [
            manager.switchVPN(vpnConfigs[0]!).catch(e => logger.warn('Switch 1 error:', e.message)),
            manager.switchVPN(vpnConfigs[1]!).catch(e => logger.warn('Switch 2 error:', e.message)),
            manager.switchVPN(vpnConfigs[2]!).catch(e => logger.warn('Switch 3 error:', e.message))
        ];
        
        logger.info('🔄 Attempting concurrent VPN switches...');
        await Promise.allSettled(switchPromises);
        
        logger.info('✅ VPN switching completed without race conditions');
        logger.info(`Current VPN: ${manager.currentVPN?.name || 'none'}`);
        
        // Демонстрация 2: Параллельные HTTP запросы с ограничением
        logger.info('\n--- Demo 2: Concurrent HTTP Requests with Semaphore ---');
        
        // Создаем много параллельных запросов (больше чем разрешено семафором)
        const requestPromises = Array.from({ length: 15 }, (_, i) => 
            requester.get(`https://httpbin.org/delay/${Math.random() * 2}`, {})
                .then(() => logger.debug(`✅ Request ${i + 1} completed`))
                .catch(e => logger.warn(`❌ Request ${i + 1} failed:`, e.message))
        );
        
        logger.info('🔄 Starting 15 concurrent HTTP requests (max 10 allowed)...');
        const startTime = Date.now();
        
        await Promise.allSettled(requestPromises);
        const duration = Date.now() - startTime;
        
        logger.info(`✅ All requests completed in ${duration}ms with concurrency control`);
        
        // Показываем статус после запросов
        logger.info('📊 Requester status after concurrent requests:');
        console.log(JSON.stringify(requester.getStatus(), null, 2));
        
        // Демонстрация 3: Одновременные операции с конфигурацией
        logger.info('\n--- Demo 3: Configuration Operations Protection ---');
        
        // Пытаемся одновременно выполнить операции, которые могут конфликтовать
        const configPromises = [
            manager.connectToBestVPN().catch(e => logger.warn('Connect best error:', e.message)),
            manager.stop().then(() => manager.start()).catch(e => logger.warn('Restart error:', e.message)),
            manager.switchVPN(vpnConfigs[1]!).catch(e => logger.warn('Switch during restart error:', e.message))
        ];
        
        logger.info('🔄 Attempting concurrent configuration operations...');
        await Promise.allSettled(configPromises);
        
        logger.info('✅ Configuration operations completed safely');
        
        // Демонстрация 4: Стресс-тест с быстрыми переключениями
        logger.info('\n--- Demo 4: Rapid VPN Switching Stress Test ---');
        
        const rapidSwitches = [];
        for (let i = 0; i < 5; i++) {
            const targetVPN = vpnConfigs[i % vpnConfigs.length]!;
            rapidSwitches.push(
                manager.switchVPN(targetVPN)
                    .then(() => logger.debug(`✅ Rapid switch ${i + 1} to ${targetVPN.name}`))
                    .catch(e => logger.warn(`❌ Rapid switch ${i + 1} failed:`, e.message))
            );
            
            // Небольшая задержка между попытками
            await delay(100);
        }
        
        logger.info('🔄 Performing rapid VPN switches...');
        await Promise.allSettled(rapidSwitches);
        
        logger.info('✅ Rapid switching stress test completed');
        logger.info(`Final VPN: ${manager.currentVPN?.name || 'none'}`);
        
        // Финальная статистика синхронизации
        logger.info('\n📊 Final concurrency status:');
        const finalStatus = manager.getConcurrencyStatus();
        console.log(JSON.stringify(finalStatus, null, 2));
        
        // Проверяем, что все мьютексы освобождены
        const hasLockedMutexes = Object.values(finalStatus.mutexes).some(locked => locked);
        const hasQueuedOperations = Object.values(finalStatus.semaphores)
            .some(sem => sem.queue > 0) || finalStatus.locks.vpnList.readQueue > 0 || finalStatus.locks.vpnList.writeQueue > 0;
        
        if (!hasLockedMutexes && !hasQueuedOperations) {
            logger.info('✅ All synchronization primitives are clean - no deadlocks detected');
        } else {
            logger.warn('⚠️ Some synchronization primitives are still active');
        }
        
        logger.info('✅ Race condition protection demo completed successfully!');
        
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
 * Демонстрация различных паттернов синхронизации
 */
async function demonstrateSynchronizationPatterns(): Promise<void> {
    logger.info('\n🔄 === Synchronization Patterns Demo ===');
    
    const { AsyncMutex, AsyncSemaphore, AsyncReadWriteLock } = await import('../src/concurrency');
    
    // Демонстрация мьютекса
    logger.info('\n--- Mutex Pattern ---');
    const mutex = new AsyncMutex();
    
    const mutexTasks = Array.from({ length: 3 }, (_, i) => 
        mutex.runWithLock(async () => {
            logger.info(`🔒 Task ${i + 1} acquired mutex`);
            await delay(1000);
            logger.info(`🔓 Task ${i + 1} releasing mutex`);
        })
    );
    
    await Promise.all(mutexTasks);
    
    // Демонстрация семафора
    logger.info('\n--- Semaphore Pattern ---');
    const semaphore = new AsyncSemaphore(2); // Максимум 2 одновременные операции
    
    const semaphoreTasks = Array.from({ length: 5 }, (_, i) => 
        semaphore.runWithPermit(async () => {
            logger.info(`🎫 Task ${i + 1} acquired permit (${semaphore.getAvailablePermits()} left)`);
            await delay(800);
            logger.info(`🎫 Task ${i + 1} releasing permit`);
        })
    );
    
    await Promise.all(semaphoreTasks);
    
    // Демонстрация ReadWrite блокировки
    logger.info('\n--- ReadWrite Lock Pattern ---');
    const rwLock = new AsyncReadWriteLock();
    
    const rwTasks = [
        // Читатели
        ...Array.from({ length: 3 }, (_, i) => 
            rwLock.runWithReadLock(async () => {
                logger.info(`📖 Reader ${i + 1} reading data`);
                await delay(500);
                logger.info(`📖 Reader ${i + 1} finished reading`);
            })
        ),
        // Писатель
        rwLock.runWithWriteLock(async () => {
            logger.info(`✍️ Writer updating data`);
            await delay(1000);
            logger.info(`✍️ Writer finished updating`);
        }),
        // Еще читатели
        ...Array.from({ length: 2 }, (_, i) => 
            rwLock.runWithReadLock(async () => {
                logger.info(`📖 Reader ${i + 4} reading updated data`);
                await delay(300);
                logger.info(`📖 Reader ${i + 4} finished reading`);
            })
        )
    ];
    
    await Promise.all(rwTasks);
    
    logger.info('✅ Synchronization patterns demo completed!');
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

// Главная функция
async function main(): Promise<void> {
    try {
        await demonstrateRaceConditionProtection();
        await demonstrateSynchronizationPatterns();
    } catch (error) {
        logger.error('Main demo error:', error);
        process.exit(1);
    }
}

// Запускаем демонстрацию
if (require.main === module) {
    main().catch(error => {
        logger.error('Unhandled error in race conditions demo:', error);
        process.exit(1);
    });
}

export { demonstrateRaceConditionProtection, demonstrateSynchronizationPatterns };
