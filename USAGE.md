# PaliVPN Class Usage

Файл `src/index.ts` теперь экспортирует класс `PaliVPN`, который предоставляет простой интерфейс для работы с VPN и выполнения HTTP запросов.

## Основное использование

```typescript
import PaliVPN from './src/index';

// Создание экземпляра
const vpnClient = new PaliVPN();

// Выполнение запроса
const response = await vpnClient.request({
    url: 'https://httpbin.org/ip',
    method: 'GET'
});

const data = await response.json();
console.log('IP через VPN:', data.origin);

// Остановка VPN
await vpnClient.stop();
```

## Serverless использование

PaliVPN поддерживает работу в serverless окружениях без доступа к файловой системе.

### Способ 1: Статический метод withVPNConfigs()

```typescript
import { PaliVPN, VPNConfig } from './src/index';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'server1',
        config: `client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite`,
        priority: 1,
        active: false,
        type: 'openvpn'
    }
];

// Создание с предопределенными конфигурациями
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
    logLevel: 'info',
    healthCheckInterval: 30000
});
```

### Способ 2: Через конструктор

```typescript
import PaliVPN from './src/index';

const vpnClient = new PaliVPN({
    vpnConfigs: vpnConfigs,
    logLevel: 'warn',
    maxReconnectAttempts: 2
});
```

### Пример AWS Lambda функции

```typescript
export async function lambdaHandler(event: any, context: any) {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);

    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: 'https://httpbin.org/ip'
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify(await response.json())
        };
    } finally {
        await vpnClient.stop();
    }
}
```

## API методы

### Constructor
```typescript
new PaliVPN(config?: Partial<AppConfig>, vpnConfigs?: VPNConfig[])
```
Создает новый экземпляр VPN клиента с опциональной конфигурацией и VPN серверами.

### Статический метод withVPNConfigs()
```typescript
static withVPNConfigs(vpnConfigs: VPNConfig[], config?: Partial<AppConfig>): PaliVPN
```
Создает экземпляр с предопределенными VPN конфигурациями (удобно для serverless).

### request()
```typescript
async request(config: RequestConfig): Promise<Response>
```
Выполняет HTTP запрос через активный VPN туннель. Автоматически инициализирует VPN при первом запросе.

### initialize()
```typescript
async initialize(): Promise<void>
```
Явная инициализация VPN клиента. Автоматически вызывается при первом запросе.

### stop()
```typescript
async stop(): Promise<void>
```
Останавливает VPN соединение и освобождает ресурсы.

## Свойства

### isConnected
```typescript
get isConnected(): boolean
```
Возвращает статус VPN соединения.

### currentVPN
```typescript
get currentVPN(): VPNConfig | null
```
Возвращает информацию о текущем активном VPN.

### manager
```typescript
get manager(): VPNManager
```
Предоставляет доступ к VPN менеджеру для расширенного использования.

### httpClient
```typescript
get httpClient(): VPNRequester
```
Предоставляет доступ к HTTP клиенту для расширенного использования.

## Примеры запросов

### GET запрос
```typescript
const response = await vpnClient.request({
    url: 'https://api.example.com/data'
});
```

### POST с JSON данными
```typescript
const response = await vpnClient.request({
    url: 'https://api.example.com/submit',
    method: 'POST',
    body: { message: 'Hello World!' },
    headers: {
        'Content-Type': 'application/json'
    }
});
```

### Запрос с кастомными заголовками
```typescript
const response = await vpnClient.request({
    url: 'https://api.example.com/protected',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer your-token',
        'X-Custom-Header': 'custom-value'
    }
});
```

## Запуск примеров

```bash
# Простой пример использования
npm run example:simple

# Расширенный пример использования
npm run example:usage

# Полный пример с демонстрацией всех возможностей
npm run example
```

## Конфигурация

Класс использует ту же систему конфигурации, что и остальная часть проекта:
- Файл `config.json`
- Переменные окружения
- Переданные параметры в конструктор

Пример кастомной конфигурации:
```typescript
const vpnClient = new PaliVPN({
    httpTimeout: 15000,
    userAgent: 'MyApp/1.0',
    logLevel: 'debug'
});
```
