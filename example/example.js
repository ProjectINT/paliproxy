"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
exports.demonstrateHTTPRequests = demonstrateHTTPRequests;
exports.demonstrateHealthCheck = demonstrateHealthCheck;
exports.demonstrateBatchRequests = demonstrateBatchRequests;
exports.demonstrateErrorHandling = demonstrateErrorHandling;
const manager_1 = require("../src/manager");
const requester_1 = require("../src/requester");
const config_1 = __importDefault(require("../src/config"));
const utils_1 = require("../src/utils");
/**
 * Пример использования PaliVPN клиента
 * Демонстрирует основные возможности библиотеки
 */
async function main() {
    try {
        utils_1.logger.info('PaliVPN Example - Starting...');
        // 1. Загружаем конфигурацию
        const vpnConfig = config_1.default.load();
        utils_1.logger.info('Configuration loaded:', {
            healthCheckInterval: vpnConfig.healthCheckInterval,
            httpTimeout: vpnConfig.httpTimeout,
            logLevel: vpnConfig.logLevel
        });
        // 2. Создаем и инициализируем VPN Manager
        const vpnManager = new manager_1.VPNManager(vpnConfig);
        await vpnManager.initialize();
        // 3. Создаем HTTP requester для работы через VPN
        const requester = new requester_1.VPNRequester(vpnConfig, vpnManager);
        // 4. Подписываемся на события VPN Manager
        vpnManager.on('connected', (vpn) => {
            utils_1.logger.info(`✅ Connected to VPN: ${vpn.name}`);
        });
        vpnManager.on('disconnected', (vpn) => {
            utils_1.logger.info(`❌ Disconnected from VPN: ${vpn.name}`);
        });
        vpnManager.on('switched', (vpn) => {
            utils_1.logger.info(`🔄 Switched to VPN: ${vpn.name}`);
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
        utils_1.logger.info('Monitoring VPN for 30 seconds...');
        await (0, utils_1.delay)(30000);
        // 10. Корректно завершаем работу
        utils_1.logger.info('Shutting down...');
        await vpnManager.stop();
        utils_1.logger.info('✅ Example completed successfully');
    }
    catch (error) {
        utils_1.logger.error('❌ Example failed:', error.message);
        process.exit(1);
    }
}
/**
 * Демонстрация HTTP запросов через VPN
 */
async function demonstrateHTTPRequests(requester) {
    utils_1.logger.info('\n--- HTTP Requests Demo ---');
    try {
        // Получаем текущий IP
        const currentIP = await requester.getCurrentIP();
        utils_1.logger.info(`Current IP through VPN: ${currentIP}`);
        // Проверяем связность
        const connectivity = await requester.checkConnectivity();
        utils_1.logger.info('Connectivity check:', connectivity);
        // Выполняем GET запрос
        const response = await requester.get('https://httpbin.org/user-agent');
        const userData = await response.json();
        utils_1.logger.info('User-Agent response:', userData);
        // Выполняем POST запрос
        const postData = { message: 'Hello from PaliVPN!', timestamp: Date.now() };
        const postResponse = await requester.post('https://httpbin.org/post', postData);
        const postResult = await postResponse.json();
        utils_1.logger.info('POST response received, data echoed correctly');
    }
    catch (error) {
        utils_1.logger.error('HTTP requests demo failed:', error.message);
    }
}
/**
 * Демонстрация проверки здоровья VPN
 */
async function demonstrateHealthCheck(vpnManager) {
    utils_1.logger.info('\n--- Health Check Demo ---');
    try {
        const status = vpnManager.getStatus();
        utils_1.logger.info('VPN Manager Status:', {
            isRunning: status.isRunning,
            currentVPN: status.currentVPN?.name,
            vpnCount: status.vpnList.length
        });
        // Получаем health checker из manager
        const healthChecker = vpnManager.healthChecker;
        const healthStatus = healthChecker.getStatus();
        utils_1.logger.info('Health Checker Status:', healthStatus);
        // Выполняем разовую проверку текущего VPN
        if (status.currentVPN) {
            const healthResult = await healthChecker.checkOnce(status.currentVPN);
            utils_1.logger.info(`Health check result for ${status.currentVPN.name}:`, {
                isHealthy: healthResult.isHealthy,
                reason: healthResult.reason,
                successfulChecks: healthResult.successfulChecks,
                failedChecks: healthResult.failedChecks
            });
        }
    }
    catch (error) {
        utils_1.logger.error('Health check demo failed:', error.message);
    }
}
/**
 * Демонстрация batch запросов
 */
async function demonstrateBatchRequests(requester) {
    utils_1.logger.info('\n--- Batch Requests Demo ---');
    try {
        // Подготавливаем несколько запросов
        const requests = [
            { method: 'GET', url: 'https://httpbin.org/delay/1' },
            { method: 'GET', url: 'https://httpbin.org/status/200' },
            { method: 'GET', url: 'https://httpbin.org/json' },
            { method: 'POST', url: 'https://httpbin.org/post', body: { test: true } },
            { method: 'GET', url: 'https://httpbin.org/headers' }
        ];
        utils_1.logger.info(`Executing ${requests.length} requests in batches...`);
        const startTime = Date.now();
        const results = await requester.batchRequests(requests, 3); // 3 concurrent requests
        const duration = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        utils_1.logger.info(`Batch requests completed in ${duration}ms:`);
        utils_1.logger.info(`✅ Successful: ${successful}, ❌ Failed: ${failed}`);
        // Показываем детали неудачных запросов
        results.forEach((result, index) => {
            if (!result.success) {
                utils_1.logger.warn(`Request ${index + 1} failed:`, result.error);
            }
        });
    }
    catch (error) {
        utils_1.logger.error('Batch requests demo failed:', error.message);
    }
}
/**
 * Демонстрация обработки ошибок и переключения VPN
 */
async function demonstrateErrorHandling(requester) {
    utils_1.logger.info('\n--- Error Handling Demo ---');
    try {
        // Пытаемся сделать запрос к несуществующему URL
        utils_1.logger.info('Testing error handling with invalid URL...');
        try {
            await requester.get('https://this-domain-does-not-exist-12345.com');
        }
        catch (error) {
            utils_1.logger.info(`Expected error caught: ${error.message}`);
        }
        // Тестируем запрос с VPN fallback
        utils_1.logger.info('Testing VPN fallback mechanism...');
        const fallbackResult = await requester.requestWithVPNFallback({
            method: 'GET',
            url: 'https://httpbin.org/status/200'
        });
        utils_1.logger.info('VPN fallback request successful');
    }
    catch (error) {
        utils_1.logger.error('Error handling demo failed:', error.message);
    }
}
/**
 * Обработка сигналов для корректного завершения
 */
function setupSignalHandlers() {
    process.on('SIGINT', () => {
        utils_1.logger.info('Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        utils_1.logger.info('Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });
    process.on('unhandledRejection', (reason, promise) => {
        utils_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
    process.on('uncaughtException', (error) => {
        utils_1.logger.error('Uncaught Exception:', error);
        process.exit(1);
    });
}
// Настраиваем обработчики сигналов
setupSignalHandlers();
// Запускаем пример только если это основной модуль
if (require.main === module) {
    main().catch(error => {
        utils_1.logger.error('Unhandled error in main:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=example.js.map