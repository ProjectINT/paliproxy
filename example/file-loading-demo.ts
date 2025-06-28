import { PaliVPN } from '../src/index';
import { logger } from '../src/utils';
import type { VPNConfig } from '../src/types';

/**
 * Демонстрация загрузки VPN конфигураций из файлов
 * 
 * Этот пример показывает:
 * 1. Загрузку VPN конфигураций из директории configs/
 * 2. Использование environment переменных для настройки
 * 3. Автоматическое определение типов VPN файлов
 */

async function demonstrateFileLoading() {
    logger.info('=== Демонстрация загрузки VPN конфигураций из файлов ===');
    
    try {
        // Создаем PaliVPN с настройками из environment и config.json
        const vpn = new PaliVPN({
            // Переопределяем путь к конфигурациям если нужно
            vpnConfigsPath: process.env.PALIVPN_CONFIG_PATH || './configs',
            logLevel: 'debug'
        });
        
        logger.info('Инициализируем PaliVPN...');
        await vpn.initialize();
        
        // Получаем статус менеджера для просмотра загруженных VPN
        const status = vpn.getVPNManager().getStatus();
        
        logger.info(`Загружено VPN конфигураций: ${status.vpnList.length}`);
        
        if (status.vpnList.length === 0) {
            logger.warn('Не найдено VPN конфигураций!');
            logger.info('Убедитесь что в директории ./configs есть .ovpn, .conf, .wg или .json файлы');
            return;
        }
        
        // Показываем информацию о каждой загруженной конфигурации
        logger.info('\n=== Загруженные VPN конфигурации ===');
        status.vpnList.forEach((vpnConfig: VPNConfig, index: number) => {
            logger.info(`${index + 1}. ${vpnConfig.name}`);
            logger.info(`   Тип: ${vpnConfig.type}`);
            logger.info(`   Приоритет: ${vpnConfig.priority}`);
            logger.info(`   Активен: ${vpnConfig.active ? 'Да' : 'Нет'}`);
            logger.info(`   Размер конфигурации: ${vpnConfig.config.length} символов`);
            logger.info('   ---');
        });
        
        // Пробуем подключиться к первому доступному VPN
        if (status.vpnList.length > 0) {
            const firstVPN = status.vpnList[0];
            if (!firstVPN) {
                logger.error('Первый VPN в списке не определен');
                return;
            }
            
            logger.info(`\nПытаемся подключиться к: ${firstVPN.name}`);
            
            try {
                await vpn.getVPNManager().connect(firstVPN);
                logger.info(`✅ Успешно подключен к ${firstVPN.name}`);
                
                // Проверяем IP адрес через наш VPN
                const response = await vpn.request({
                    url: 'https://httpbin.org/ip',
                    method: 'GET'
                });
                
                const ipData = await response.json() as { origin: string };
                logger.info(`Текущий IP адрес: ${ipData.origin}`);
                
                // Отключаемся
                await vpn.getVPNManager().disconnect();
                logger.info(`✅ Отключен от ${firstVPN.name}`);
                
            } catch (error) {
                logger.error(`❌ Ошибка подключения к ${firstVPN.name}:`, (error as Error).message);
                logger.info('Возможные причины:');
                logger.info('- VPN клиент не установлен (openvpn, wg, strongswan)');
                logger.info('- Неверные данные аутентификации');
                logger.info('- Проблемы с сетевым подключением');
            }
        }
        
    } catch (error) {
        logger.error('Ошибка в демонстрации:', (error as Error).message);
    }
}

async function showEnvironmentConfig() {
    logger.info('\n=== Настройки из Environment Variables ===');
    
    const envVars = [
        'PALIVPN_CONFIG_PATH',
        'PALIVPN_VPN_TIMEOUT', 
        'PALIVPN_LOG_LEVEL',
        'PALIVPN_HEALTH_CHECK_URL',
        'NODE_ENV'
    ];
    
    envVars.forEach(envVar => {
        const value = process.env[envVar];
        logger.info(`${envVar}: ${value || 'не установлено'}`);
    });
    
    logger.info('\nДля настройки используйте:');
    logger.info('export PALIVPN_CONFIG_PATH=/path/to/configs');
    logger.info('export PALIVPN_LOG_LEVEL=debug');
    logger.info('export PALIVPN_VPN_TIMEOUT=45000');
}

// Запуск демонстрации
async function main() {
    await showEnvironmentConfig();
    await demonstrateFileLoading();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { demonstrateFileLoading, showEnvironmentConfig };
