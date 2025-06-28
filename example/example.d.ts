import { VPNManager } from '../src/manager';
import { VPNRequester } from '../src/requester';
/**
 * Пример использования PaliVPN клиента
 * Демонстрирует основные возможности библиотеки
 */
declare function main(): Promise<void>;
/**
 * Демонстрация HTTP запросов через VPN
 */
declare function demonstrateHTTPRequests(requester: VPNRequester): Promise<void>;
/**
 * Демонстрация проверки здоровья VPN
 */
declare function demonstrateHealthCheck(vpnManager: VPNManager): Promise<void>;
/**
 * Демонстрация batch запросов
 */
declare function demonstrateBatchRequests(requester: VPNRequester): Promise<void>;
/**
 * Демонстрация обработки ошибок и переключения VPN
 */
declare function demonstrateErrorHandling(requester: VPNRequester): Promise<void>;
export { main, demonstrateHTTPRequests, demonstrateHealthCheck, demonstrateBatchRequests, demonstrateErrorHandling };
//# sourceMappingURL=example.d.ts.map