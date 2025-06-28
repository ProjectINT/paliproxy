# VPN Configuration Examples for Serverless

Этот файл содержит примеры конфигураций VPN для использования в различных serverless платформах.

## 🔑 Базовые конфигурации

### OpenVPN конфигурация
```typescript
const openvpnConfig: VPNConfig = {
    name: 'openvpn-server',
    config: `client
dev tun
proto udp
remote your-vpn-server.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3`,
    priority: 1,
    active: false,
    type: 'openvpn',
    auth: {
        username: 'user',
        password: 'pass'
    }
};
```

### WireGuard конфигурация
```typescript
const wireguardConfig: VPNConfig = {
    name: 'wireguard-server',
    config: `[Interface]
PrivateKey = your-private-key
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = server-public-key
Endpoint = your-vpn-server.com:51820
AllowedIPs = 0.0.0.0/0`,
    priority: 1,
    active: false,
    type: 'wireguard'
};
```

## 🌐 Платформо-специфичные примеры

### AWS Lambda
```typescript
// lambda-function.ts
import { PaliVPN, VPNConfig } from 'palivpn';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'aws-vpn-1',
        config: process.env.VPN_CONFIG_1!,
        priority: 1,
        active: false,
        type: 'openvpn'
    },
    {
        name: 'aws-vpn-2',
        config: process.env.VPN_CONFIG_2!,
        priority: 2,
        active: false,
        type: 'openvpn'
    }
];

export const handler = async (event: any, context: any) => {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
        logLevel: 'info',
        healthCheckInterval: 30000,
        maxReconnectAttempts: 2
    });

    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: event.url || 'https://httpbin.org/ip',
            method: event.method || 'GET',
            headers: event.headers
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                vpnServer: vpnClient.currentVPN?.name,
                data: await response.json()
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            })
        };
    } finally {
        await vpnClient.stop();
    }
};
```

### Vercel Edge Functions
```typescript
// api/proxy.ts
import { PaliVPN, VPNConfig } from 'palivpn';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'vercel-vpn',
        config: process.env.VPN_CONFIG!,
        priority: 1,
        active: false,
        type: 'openvpn'
    }
];

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
        logLevel: 'warn',
        healthCheckInterval: 60000
    });

    try {
        const url = new URL(req.url);
        const targetUrl = url.searchParams.get('url');
        
        if (!targetUrl) {
            return new Response('Missing url parameter', { status: 400 });
        }

        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: targetUrl,
            method: req.method as any,
            headers: Object.fromEntries(req.headers.entries()),
            body: req.body
        });

        return new Response(response.body, {
            status: response.status,
            headers: response.headers
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await vpnClient.stop();
    }
}
```

### Netlify Functions
```typescript
// netlify/functions/vpn-proxy.ts
import { Handler } from '@netlify/functions';
import { PaliVPN, VPNConfig } from 'palivpn';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'netlify-vpn',
        config: process.env.VPN_CONFIG!,
        priority: 1,
        active: false,
        type: 'openvpn'
    }
];

export const handler: Handler = async (event, context) => {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);

    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: event.queryStringParameters?.url || 'https://httpbin.org/ip',
            method: (event.httpMethod as any) || 'GET'
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                data: await response.json()
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            })
        };
    } finally {
        await vpnClient.stop();
    }
};
```

### Cloudflare Workers
```typescript
// worker.ts
import { PaliVPN, VPNConfig } from 'palivpn';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'cloudflare-vpn',
        config: 'YOUR_VPN_CONFIG_HERE',
        priority: 1,
        active: false,
        type: 'openvpn'
    }
];

export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
            logLevel: 'warn'
        });

        try {
            await vpnClient.initialize();
            
            const url = new URL(request.url);
            const targetUrl = url.searchParams.get('url');
            
            if (!targetUrl) {
                return new Response('Missing url parameter', { status: 400 });
            }

            const response = await vpnClient.request({
                url: targetUrl,
                method: request.method as any,
                headers: Object.fromEntries(request.headers.entries())
            });

            return new Response(response.body, {
                status: response.status,
                headers: response.headers
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: error instanceof Error ? error.message : String(error)
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        } finally {
            await vpnClient.stop();
        }
    }
};
```

## 📋 Конфигурационные паттерны

### Переменные окружения
```bash
# .env или настройки serverless платформы
VPN_CONFIG_1="client\ndev tun\nproto udp\nremote vpn1.com 1194\n..."
VPN_CONFIG_2="client\ndev tun\nproto tcp\nremote vpn2.com 443\n..."
VPN_USERNAME="username"
VPN_PASSWORD="password"
```

### Конфигурация с failover
```typescript
const vpnConfigs: VPNConfig[] = [
    {
        name: 'primary-vpn',
        config: process.env.PRIMARY_VPN_CONFIG!,
        priority: 1,
        active: false,
        type: 'openvpn'
    },
    {
        name: 'backup-vpn',
        config: process.env.BACKUP_VPN_CONFIG!,
        priority: 2,
        active: false,
        type: 'openvpn'
    },
    {
        name: 'emergency-vpn',
        config: process.env.EMERGENCY_VPN_CONFIG!,
        priority: 3,
        active: false,
        type: 'wireguard'
    }
];
```

### Региональные конфигурации
```typescript
const getRegionalVPNConfigs = (region: string): VPNConfig[] => {
    const configs: Record<string, VPNConfig[]> = {
        'us-east-1': [
            {
                name: 'us-east-vpn-1',
                config: process.env.US_EAST_VPN_1!,
                priority: 1,
                active: false
            }
        ],
        'eu-west-1': [
            {
                name: 'eu-west-vpn-1',
                config: process.env.EU_WEST_VPN_1!,
                priority: 1,
                active: false
            }
        ]
    };
    
    return configs[region] || configs['us-east-1'];
};
```

## 🚀 Запуск примеров

```bash
# Пример для serverless окружения
npm run example:serverless

# Минимальный пример
npm run example:minimal

# Демо serverless функций
npm run example:serverless-demo
```
