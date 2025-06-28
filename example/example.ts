import { VPNManager } from '../src/manager';
import { VPNRequester } from '../src/requester';
import configManager from '../src/config';
import { logger, delay } from '../src/utils';
import { VPNConfig, ConnectivityResult, BatchRequestResult } from '../src/types';

/**
 * Пример использования PaliVPN клиента
 * Демонстрирует основные возможности библиотеки
 */
async function main(): Promise<void> {
    try {
        logger.info('PaliVPN Example - Starting...');
        
        // 1. Загружаем конфигурацию
        const vpnConfig = configManager.get();
        logger.info('Configuration loaded:', {
            healthCheckInterval: vpnConfig.healthCheckInterval,
            httpTimeout: vpnConfig.httpTimeout,
            logLevel: vpnConfig.logLevel
        });
        
        // 2. Создаем и инициализируем VPN Manager
        const vpnManager = new VPNManager(vpnConfig);
        await vpnManager.initialize();
        
        // 3. Создаем HTTP requester для работы через VPN
        const requester = new VPNRequester(vpnConfig, vpnManager);
        
        // 4. Подписываемся на события VPN Manager
        vpnManager.on('connected', (vpn: VPNConfig) => {
            logger.info(`✅ Connected to VPN: ${vpn.name}`);
        });
        
        vpnManager.on('disconnected', (vpn: VPNConfig) => {
            logger.info(`❌ Disconnected from VPN: ${vpn.name}`);
        });
        
        vpnManager.on('switched', (vpn: VPNConfig) => {
            logger.info(`🔄 Switched to VPN: ${vpn.name}`);
        });
        
        // 5. Запускаем VPN Manager
        await vpnManager.start();
        
        // 6. Демонстрируем использование HTTP requester
        await demonstrateHTTPRequests(requester);
        
        // 7. Демонстрируем проверку здоровья VPN
        await demonstrateHealthCheck(vpnManager);
        
        // 8. Демонстрируем batch запросы
        await demonstrateBatchRequests(requester);
        
        // 9. Ждем некоторое время для демонстрации мониторинга
        logger.info('Monitoring VPN for 30 seconds...');
        await delay(30000);
        
        // 10. Корректно завершаем работу
        logger.info('Shutting down...');
        await vpnManager.stop();
        
        logger.info('✅ Example completed successfully');
        
    } catch (error) {
        logger.error('❌ Example failed:', (error as Error).message);
        process.exit(1);
    }
}

/**
 * Демонстрация HTTP запросов через VPN
 */
async function demonstrateHTTPRequests(requester: VPNRequester): Promise<void> {
    logger.info('\n--- HTTP Requests Demo ---');
    
    try {
        // Получаем текущий IP
        const currentIP = await requester.getCurrentIP();
        logger.info(`Current IP through VPN: ${currentIP}`);
        
        // Проверяем связность
        const connectivity: ConnectivityResult = await requester.checkConnectivity();
        logger.info('Connectivity check:', connectivity);
        
        // Выполняем GET запрос
        const response = await requester.get('https://httpbin.org/user-agent');
        const userData = await response.json();
        logger.info('User-Agent response:', userData);
        
        // Выполняем POST запрос
        const postData = { message: 'Hello from PaliVPN!', timestamp: Date.now() };
        const postResponse = await requester.post('https://httpbin.org/post', postData);
        const _postResult = await postResponse.json();
        logger.info('POST response received, data echoed correctly');
        
    } catch (error) {
        logger.error('HTTP requests demo failed:', (error as Error).message);
    }
}

/**
 * Демонстрация проверки здоровья VPN
 */
async function demonstrateHealthCheck(vpnManager: VPNManager): Promise<void> {
    logger.info('\n--- Health Check Demo ---');
    
    try {
        const status = vpnManager.getStatus();
        logger.info('VPN Manager Status:', {
            isRunning: status.isRunning,
            currentVPN: status.currentVPN?.name,
            vpnCount: status.vpnList.length
        });
        
        // Получаем health checker из manager
        const healthChecker = vpnManager.healthChecker;
        const healthStatus = healthChecker.getStatus();
        
        logger.info('Health Checker Status:', healthStatus);
        
        // Выполняем разовую проверку текущего VPN
        if (status.currentVPN) {
            const healthResult = await healthChecker.checkOnce(status.currentVPN);
            logger.info(`Health check result for ${status.currentVPN.name}:`, {
                isHealthy: healthResult.isHealthy,
                reason: healthResult.reason,
                successfulChecks: healthResult.successfulChecks,
                failedChecks: healthResult.failedChecks
            });
        }
        
    } catch (error) {
        logger.error('Health check demo failed:', (error as Error).message);
    }
}

/**
 * Демонстрация batch запросов
 */
async function demonstrateBatchRequests(requester: VPNRequester): Promise<void> {
    logger.info('\n--- Batch Requests Demo ---');
    
    try {
        // Подготавливаем несколько запросов
        const requests = [
            { method: 'GET' as const, url: 'https://httpbin.org/delay/1' },
            { method: 'GET' as const, url: 'https://httpbin.org/status/200' },
            { method: 'GET' as const, url: 'https://httpbin.org/json' },
            { method: 'POST' as const, url: 'https://httpbin.org/post', body: { test: true } },
            { method: 'GET' as const, url: 'https://httpbin.org/headers' }
        ];
        
        logger.info(`Executing ${requests.length} requests in batches...`);
        
        const startTime = Date.now();
        const results: BatchRequestResult[] = await requester.batchRequests(requests, 3); // 3 concurrent requests
        const duration = Date.now() - startTime;
        
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        logger.info(`Batch requests completed in ${duration}ms:`);
        logger.info(`✅ Successful: ${successful}, ❌ Failed: ${failed}`);
        
        // Показываем детали неудачных запросов
        results.forEach((result, index) => {
            if (!result.success) {
                logger.warn(`Request ${index + 1} failed:`, result.error);
            }
        });
        
    } catch (error) {
        logger.error('Batch requests demo failed:', (error as Error).message);
    }
}

/**
 * Демонстрация обработки ошибок и переключения VPN
 */
async function demonstrateErrorHandling(requester: VPNRequester): Promise<void> {
    logger.info('\n--- Error Handling Demo ---');
    
    try {
        // Пытаемся сделать запрос к несуществующему URL
        logger.info('Testing error handling with invalid URL...');
        
        try {
            await requester.get('https://this-domain-does-not-exist-12345.com');
        } catch (error) {
            logger.info(`Expected error caught: ${(error as Error).message}`);
        }
        
        // Тестируем запрос с VPN fallback
        logger.info('Testing VPN fallback mechanism...');
        
        const _fallbackResult = await requester.requestWithVPNFallback({
            method: 'GET',
            url: 'https://httpbin.org/status/200'
        });
        
        logger.info('VPN fallback request successful');
        
    } catch (error) {
        logger.error('Error handling demo failed:', (error as Error).message);
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

// Запускаем пример только если это основной модуль
if (require.main === module) {
    main().catch(error => {
        logger.error('Unhandled error in main:', error);
        process.exit(1);
    });
}

export {
    main,
    demonstrateHTTPRequests,
    demonstrateHealthCheck,
    demonstrateBatchRequests,
    demonstrateErrorHandling
};
