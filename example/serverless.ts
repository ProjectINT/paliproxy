import { PaliVPN, VPNConfig } from '../src/index';

/**
 * Пример использования PaliVPN в serverless функции
 * VPN конфигурации передаются напрямую, без чтения файловой системы
 */

// Предопределенные VPN конфигурации
const vpnConfigs: VPNConfig[] = [
    {
        name: 'server1',
        config: `# OpenVPN Configuration for Server 1
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
        type: 'openvpn'
    },
    {
        name: 'server2',
        config: `# OpenVPN Configuration for Server 2
client
dev tun
proto tcp
remote vpn2.example.com 443
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
verb 3`,
        priority: 2,
        active: false,
        type: 'openvpn'
    }
];

/**
 * AWS Lambda функция с использованием PaliVPN
 */
export async function lambdaHandler(event: any, context: any) {
    // Создаем экземпляр PaliVPN с предопределенными конфигурациями
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
        logLevel: 'info',
        healthCheckInterval: 30000,
        maxReconnectAttempts: 2
    });

    try {
        // Инициализируем VPN соединение
        await vpnClient.initialize();

        // Выполняем запрос через VPN
        const response = await vpnClient.request({
            url: 'https://httpbin.org/ip',
            method: 'GET'
        });

        const data = await response.json();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Request completed successfully',
                vpnServer: vpnClient.currentVPN?.name,
                responseData: data
            })
        };

    } catch (error) {
        console.error('Error in lambda function:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : String(error)
            })
        };
    } finally {
        // Останавливаем VPN соединение
        await vpnClient.stop();
    }
}

/**
 * Vercel Edge Function пример
 */
export async function vercelEdgeHandler(request: Request) {
    const vpnClient = new PaliVPN({
        vpnConfigs: vpnConfigs,
        logLevel: 'warn',
        healthCheckInterval: 60000
    });

    try {
        await vpnClient.initialize();

        const response = await vpnClient.request({
            url: 'https://api.ipify.org?format=json',
            method: 'GET'
        });

        const ipData = await response.json();

        return new Response(JSON.stringify({
            success: true,
            vpnServer: vpnClient.currentVPN?.name,
            externalIP: ipData
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await vpnClient.stop();
    }
}

/**
 * Простой пример с минимальной конфигурацией
 */
export async function simpleExample() {
    // Минимальная VPN конфигурация
    const simpleVpnConfigs: VPNConfig[] = [
        {
            name: 'simple-vpn',
            config: process.env.VPN_CONFIG || '', // Можно передать через переменные окружения
            priority: 1,
            active: false
        }
    ];

    const client = PaliVPN.withVPNConfigs(simpleVpnConfigs);
    
    try {
        await client.initialize();
        
        const response = await client.request({
            url: 'https://httpbin.org/headers'
        });
        
        console.log('Response:', await response.json());
        
    } finally {
        await client.stop();
    }
}
