import { VPNManager } from '../src/manager';
import { VPNConfig } from '../src/types';
import configManager from '../src/config';
import { logger } from '../src/utils';

/**
 * Демонстрация полностью реализованного метода connect()
 * Показывает подключение к различным типам VPN
 */
async function demonstrateVPNConnection(): Promise<void> {
    try {
        logger.info('=== VPN Connection Demo ===');
        
        // Загружаем конфигурацию
        const appConfig = configManager.get();
        
        // Примеры VPN конфигураций для разных типов
        const vpnConfigs: VPNConfig[] = [
            {
                name: 'openvpn-server',
                config: `# OpenVPN Configuration
client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
verb 3`,
                priority: 1,
                active: false,
                type: 'openvpn',
                auth: {
                    username: 'user',
                    password: 'pass'
                }
            },
            {
                name: 'wireguard-server',
                config: `[Interface]
PrivateKey = your-private-key-here
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = server-public-key-here
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0`,
                priority: 2,
                active: false,
                type: 'wireguard'
            },
            {
                name: 'ikev2-server',
                config: '/etc/ipsec.conf', // Путь к конфигурации IKEv2
                priority: 3,
                active: false,
                type: 'ikev2'
            }
        ];
        
        // Добавляем VPN конфигурации в настройки
        appConfig.vpnConfigs = vpnConfigs;
        
        // Создаем VPN Manager
        const vpnManager = new VPNManager(appConfig);
        
        // Подписываемся на события
        vpnManager.on('connected', (vpn: VPNConfig) => {
            logger.info(`✅ Successfully connected to ${vpn.name} (${vpn.type})`);
        });
        
        vpnManager.on('disconnected', (vpn: VPNConfig) => {
            logger.info(`❌ Disconnected from ${vpn.name} (${vpn.type})`);
        });
        
        vpnManager.on('switched', (vpn: VPNConfig) => {
            logger.info(`🔄 Switched to ${vpn.name} (${vpn.type})`);
        });
        
        // Инициализируем менеджер
        await vpnManager.initialize();
        
        logger.info('VPN Manager initialized with configurations:');
        for (const vpn of vpnConfigs) {
            logger.info(`  - ${vpn.name} (${vpn.type})`);
        }
        
        // Демонстрируем подключение к OpenVPN
        logger.info('\n--- Testing OpenVPN Connection ---');
        try {
            const openVpnConfig = vpnConfigs[0];
            if (openVpnConfig) {
                await vpnManager.connect(openVpnConfig);
                logger.info('OpenVPN connection test completed');
                
                // Проверяем статус
                const status = vpnManager.getStatus();
                logger.info('Current status:', {
                    isRunning: status.isRunning,
                    currentVPN: status.currentVPN?.name,
                    reconnectAttempts: status.reconnectAttempts
                });
            }
            
        } catch (error) {
            logger.error('OpenVPN connection failed (expected if not installed):', (error as Error).message);
        }
        
        // Демонстрируем переключение на WireGuard
        logger.info('\n--- Testing VPN Switching ---');
        try {
            const wireGuardConfig = vpnConfigs[1];
            if (wireGuardConfig) {
                await vpnManager.switchVPN(wireGuardConfig);
                logger.info('VPN switching test completed');
            }
            
        } catch (error) {
            logger.error('WireGuard connection failed (expected if not installed):', (error as Error).message);
        }
        
        // Демонстрируем отключение
        logger.info('\n--- Testing VPN Disconnection ---');
        try {
            await vpnManager.disconnect();
            logger.info('VPN disconnection test completed');
            
        } catch (error) {
            logger.error('VPN disconnection failed:', (error as Error).message);
        }
        
        // Показываем статус параллелизма
        logger.info('\n--- Concurrency Status ---');
        const concurrencyStatus = vpnManager.getConcurrencyStatus();
        logger.info('Concurrency status:', JSON.stringify(concurrencyStatus, null, 2));
        
        logger.info('\n✅ VPN Connection Demo completed successfully');
        
    } catch (error) {
        logger.error('❌ VPN Connection Demo failed:', (error as Error).message);
        process.exit(1);
    }
}

// Запускаем демонстрацию
if (require.main === module) {
    demonstrateVPNConnection().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { demonstrateVPNConnection };
