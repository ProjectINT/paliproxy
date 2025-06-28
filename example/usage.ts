import PaliVPN, { VPNConfig } from '../src/index';

/**
 * Пример использования PaliVPN класса
 */
async function example() {
    // Создаем экземпляр клиента
    const vpnClient = new PaliVPN();

    try {
        // Выполняем запрос через VPN
        const response = await vpnClient.request({
            url: 'https://httpbin.org/ip',
            method: 'GET'
        });

        const data = await response.json();
        console.log('Response:', data);

        // Выполняем POST запрос
        const postResponse = await vpnClient.request({
            url: 'https://httpbin.org/post',
            method: 'POST',
            body: { message: 'Hello from PaliVPN!' },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const postData = await postResponse.json();
        console.log('POST Response:', postData);

    } catch (error) {
        console.error('Request failed:', error);
    } finally {
        // Останавливаем VPN клиент
        await vpnClient.stop();
    }
}

/**
 * Пример использования с предопределенными VPN конфигурациями
 * Подходит для serverless функций
 */
async function serverlessExample() {
    // Предопределенные VPN конфигурации (без чтения файловой системы)
    const vpnConfigs: VPNConfig[] = [
        {
            name: 'primary-server',
            config: process.env.VPN_CONFIG_1 || `# Sample VPN config
client
dev tun
proto udp
remote vpn1.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun`,
            priority: 1,
            active: false,
            type: 'openvpn'
        },
        {
            name: 'backup-server',
            config: process.env.VPN_CONFIG_2 || `# Sample VPN config 2
client
dev tun
proto tcp
remote vpn2.example.com 443
resolv-retry infinite
nobind
persist-key
persist-tun`,
            priority: 2,
            active: false,
            type: 'openvpn'
        }
    ];

    // Создаем клиент с предопределенными конфигурациями
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
        logLevel: 'info',
        healthCheckInterval: 30000,
        maxReconnectAttempts: 2
    });

    try {
        console.log('Инициализируем VPN с предопределенными конфигурациями...');
        await vpnClient.initialize();

        // Проверяем текущий IP
        const ipResponse = await vpnClient.request({
            url: 'https://httpbin.org/ip'
        });
        const ipData = await ipResponse.json() as { origin: string };
        console.log(`Текущий IP через VPN ${vpnClient.currentVPN?.name}:`, ipData.origin);

        // Выполняем запрос к API
        const apiResponse = await vpnClient.request({
            url: 'https://httpbin.org/headers'
        });
        const headerData = await apiResponse.json();
        console.log('Headers response:', headerData);

    } catch (error) {
        console.error('Serverless example failed:', error);
    } finally {
        await vpnClient.stop();
    }
}

/**
 * Пример с минимальной конфигурацией
 */
async function minimalExample() {
    const vpnConfigs: VPNConfig[] = [
        {
            name: 'simple-vpn',
            config: `client
dev tun
proto udp
remote example.com 1194`,
            priority: 1,
            active: false
        }
    ];

    const client = new PaliVPN({ vpnConfigs });
    
    try {
        await client.initialize();
        
        const response = await client.request({
            url: 'https://httpbin.org/get'
        });
        
        console.log('Minimal example response:', await response.json());
        
    } finally {
        await client.stop();
    }
}

// Запускаем пример
if (require.main === module) {
    const args = process.argv.slice(2);
    const mode = args[0] || 'standard';
    
    switch (mode) {
        case 'serverless':
            console.log('Запуск serverless примера...');
            serverlessExample().catch(console.error);
            break;
        case 'minimal':
            console.log('Запуск минимального примера...');
            minimalExample().catch(console.error);
            break;
        default:
            console.log('Запуск стандартного примера...');
            example().catch(console.error);
            break;
    }
}

export { example, serverlessExample, minimalExample };
