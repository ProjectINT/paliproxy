/**
 * Демонстрация системы отложенного переключения каналов
 * Показывает как работает управление переключением VPN с учетом критичности операций
 */

import { VPNManager } from '../src/manager';
import { VPNRequester } from '../src/requester';
import { 
    AppConfig, 
    VPNConfig, 
    DelayedSwitchConfig,
    SwitchReason,
    SwitchPriority,
    OperationType 
} from '../src/types';
import { logger } from '../src/utils';

// Демо конфигурация
const demoConfig: AppConfig & { delayedSwitch: DelayedSwitchConfig } = {
    vpnConfigsPath: './configs',
    defaultVpnTimeout: 30000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 30000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 10000,
    httpTimeout: 15000,
    userAgent: 'PaliVPN-DelayedSwitching-Demo/1.0',
    logLevel: 'info',
    nodeEnv: 'development',
    delayedSwitch: {
        enabled: true,
        maxDelayMs: 60000, // Максимальная задержка 60 секунд
        criticalityThresholds: {
            immediate: 90,    // >= 90 - немедленно
            fast: 70,        // 70-89 - быстро (1-5 сек)
            normal: 50,      // 50-69 - обычно (5-30 сек)
            slow: 30         // 30-49 - медленно (30+ сек)
        },
        gracePeriodMs: 10000 // 10 секунд для завершения критичных операций
    },
    vpnConfigs: [
        {
            name: 'primary-vpn',
            config: './configs/primary.ovpn',
            priority: 1,
            active: false,
            type: 'openvpn'
        },
        {
            name: 'backup-vpn',
            config: './configs/backup.ovpn',
            priority: 2,
            active: false,
            type: 'openvpn'
        },
        {
            name: 'emergency-vpn',
            config: './configs/emergency.ovpn',
            priority: 3,
            active: false,
            type: 'openvpn'
        }
    ]
};

/**
 * Симуляция критичной файловой операции
 */
async function simulateCriticalFileTransfer(
    manager: VPNManager,
    requester: VPNRequester,
    fileSize: number = 100
): Promise<string> {
    logger.info(`🗂️  Starting critical file transfer (${fileSize}MB)...`);
    
    // Регистрируем операцию как критичную
    const operationId = await manager.registerOperation({
        type: 'file_transfer',
        criticalityLevel: 85, // Высокий уровень критичности
        estimatedDuration: fileSize * 1000, // 1 секунда на MB
        canInterrupt: false, // Нельзя прерывать
        onComplete: () => logger.info('✅ File transfer completed successfully'),
        onInterrupt: () => logger.warn('⚠️  File transfer was interrupted!')
    });

    try {
        // Симулируем загрузку файла
        const transferStartTime = Date.now();
        let uploaded = 0;
        
        while (uploaded < fileSize) {
            const chunkSize = Math.min(10, fileSize - uploaded); // Загружаем по 10MB
            
            // Выполняем HTTP запрос для загрузки части файла
            await requester.post('https://httpbin.org/post', {
                chunk: uploaded / chunkSize,
                size: chunkSize,
                total: fileSize
            }, undefined, 'critical');
            
            uploaded += chunkSize;
            
            const progress = Math.round((uploaded / fileSize) * 100);
            logger.info(`📊 File transfer progress: ${progress}% (${uploaded}/${fileSize}MB)`);
            
            // Небольшая задержка для реалистичности
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        const transferTime = Date.now() - transferStartTime;
        logger.info(`✅ File transfer completed in ${transferTime}ms`);
        
        return operationId;
    } catch (error) {
        logger.error('❌ File transfer failed:', error);
        throw error;
    } finally {
        // Завершаем операцию
        await manager.completeOperation(operationId);
    }
}

/**
 * Симуляция обычных HTTP запросов
 */
async function simulateNormalTraffic(
    requester: VPNRequester,
    count: number = 5
): Promise<void> {
    logger.info(`🌐 Starting normal HTTP traffic (${count} requests)...`);
    
    const promises = Array.from({ length: count }, async (_, i) => {
        try {
            const response = await requester.get(`https://httpbin.org/delay/${Math.floor(Math.random() * 3) + 1}`, 
                undefined, 'normal');
            logger.debug(`📡 Request ${i + 1} completed: ${response.status}`);
        } catch (error) {
            logger.warn(`📡 Request ${i + 1} failed:`, error);
        }
    });
    
    await Promise.all(promises);
    logger.info('✅ Normal traffic completed');
}

/**
 * Демонстрация различных сценариев переключения
 */
async function runDelayedSwitchingDemo(): Promise<void> {
    logger.info('🚀 Starting Delayed Switching Demo...\n');

    const manager = new VPNManager(demoConfig);
    const requester = new VPNRequester(demoConfig, manager);

    try {
        // Инициализация
        await manager.initialize();
        await manager.start();
        
        const targetVPN = demoConfig.vpnConfigs![1]!; // backup-vpn
        
        logger.info('📊 Initial delayed switch status:');
        console.log(JSON.stringify(manager.getDelayedSwitchStatus(), null, 2));

        // Сценарий 1: Переключение с низкой критичности (должно быть отложено)
        logger.info('\n🔄 SCENARIO 1: Low-priority switch (should be delayed)');
        
        const lowPrioritySwitch = await manager.requestDelayedSwitch(
            targetVPN,
            'optimization',
            'low',
            40 // Низкий уровень критичности
        );
        
        logger.info(`📝 Low-priority switch requested: ${lowPrioritySwitch}`);

        // Запускаем обычный трафик
        const normalTrafficPromise = simulateNormalTraffic(requester, 3);

        // Сценарий 2: Переключение во время критичной операции
        logger.info('\n🔄 SCENARIO 2: Switch during critical operation');
        
        // Запускаем критичную операцию
        const criticalOpPromise = simulateCriticalFileTransfer(manager, requester, 50);
        
        // Пытаемся переключиться во время критичной операции
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем, пока операция начнется
        
        const criticalSwitch = await manager.requestDelayedSwitch(
            demoConfig.vpnConfigs![2]!, // emergency-vpn
            'user_request',
            'high',
            75 // Высокий уровень критичности
        );
        
        logger.info(`📝 High-priority switch requested during critical operation: ${criticalSwitch}`);

        // Проверяем статус отложенного переключения
        logger.info('\n📊 Status during critical operation:');
        const statusDuringOp = manager.getDelayedSwitchStatus();
        console.log(JSON.stringify(statusDuringOp, null, 2));

        // Ждем завершения критичной операции
        await criticalOpPromise;
        await normalTrafficPromise;

        // Сценарий 3: Экстренное переключение (должно быть немедленным)
        logger.info('\n🔄 SCENARIO 3: Emergency switch (should be immediate)');
        
        const emergencySwitch = await manager.requestDelayedSwitch(
            targetVPN,
            'emergency',
            'emergency',
            95 // Экстренный уровень критичности
        );
        
        logger.info(`📝 Emergency switch requested: ${emergencySwitch}`);

        // Ждем немного, чтобы увидеть результаты
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Сценарий 4: Отмена переключения
        logger.info('\n🔄 SCENARIO 4: Switch cancellation');
        
        const cancelableSwitch = await manager.requestDelayedSwitch(
            demoConfig.vpnConfigs![0]!, // primary-vpn
            'maintenance',
            'low',
            35
        );
        
        logger.info(`📝 Cancelable switch requested: ${cancelableSwitch}`);
        
        // Ждем немного и отменяем
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const cancelled = await manager.cancelDelayedSwitch(cancelableSwitch);
        logger.info(`🚫 Switch cancellation result: ${cancelled}`);

        // Финальный статус
        logger.info('\n📊 Final delayed switch status:');
        const finalStatus = manager.getDelayedSwitchStatus();
        console.log(JSON.stringify(finalStatus, null, 2));

        // Мониторинг активности в течение некоторого времени
        logger.info('\n⏰ Monitoring activity for 30 seconds...');
        
        const monitoringEnd = Date.now() + 30000;
        
        while (Date.now() < monitoringEnd) {
            const currentStatus = manager.getDelayedSwitchStatus();
            
            if (currentStatus.nextScheduledSwitch) {
                const timeUntil = Math.round(currentStatus.nextScheduledSwitch.timeUntilSwitch / 1000);
                logger.info(`⏳ Next switch to ${currentStatus.nextScheduledSwitch.targetVPN.name} in ${timeUntil}s`);
            }
            
            if (currentStatus.activeOperations.length > 0) {
                logger.info(`🔄 Active operations: ${currentStatus.activeOperations.length}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        logger.error('❌ Demo failed:', error);
    } finally {
        // Cleanup
        logger.info('\n🧹 Cleaning up...');
        await manager.stop();
        logger.info('✅ Delayed Switching Demo completed');
    }
}

// Запуск демо, если скрипт вызван напрямую
if (require.main === module) {
    runDelayedSwitchingDemo().catch(error => {
        logger.error('Fatal error in delayed switching demo:', error);
        process.exit(1);
    });
}

export { runDelayedSwitchingDemo };
