# PaliVPN

Автоматический VPN клиент с мониторингом здоровья соединений и переключением туннелей.

## 🚀 Особенности

- **Автоматическое управление VPN соединениями** - подключение к лучшему доступному серверу
- **Мониторинг здоровья туннелей** - постоянная проверка доступности и качества соединения  
- **Автоматическое переключение** - смена VPN при проблемах с текущим соединением
- **HTTP клиент с проксированием** - выполнение запросов через активный VPN туннель (используя нативный fetch API)
- **Простой API** - единый класс с методом `request()` для выполнения HTTP запросов через VPN
- **Буферизация запросов** - система очередей для обработки запросов с приоритетами
- **Отложенное переключение каналов** - планирование переключений VPN с задержкой
- **Гибкая конфигурация** - настройка через файлы конфигурации или прямая передача VPN конфигураций
- **Подробное логирование** - отслеживание всех операций и ошибок
- **TypeScript поддержка** - типизированные интерфейсы для разработки

## 💡 Быстрый старт

```typescript
import { PaliVPN } from './src/index';

// Создаем экземпляр VPN клиента
const vpnClient = new PaliVPN();

// Выполняем HTTP запрос через VPN
const response = await vpnClient.request({
    url: 'https://httpbin.org/ip',
    method: 'GET'
});

const data = await response.json();
console.log('Мой IP через VPN:', data.origin);

// Не забываем остановить VPN
await vpnClient.stop();
```

## 📁 Структура проекта

```
├── src/
│   ├── index.ts               # Точка входа: главный класс PaliVPN
│   ├── manager.ts             # VPNManager: логика подключения и переключения
│   ├── config.ts              # Менеджер конфигурации: загрузка настроек
│   ├── healthChecker.ts       # HealthChecker: проверка доступности туннелей
│   ├── requester.ts           # VPNRequester: HTTP-клиент через активный VPN
│   ├── requestBuffer.ts       # RequestBuffer: система очередей запросов
│   ├── channelSwitchManager.ts # Менеджер отложенного переключения каналов
│   ├── concurrency.ts         # Утилиты для работы с параллелизмом
│   ├── utils.ts               # Вспомогательные функции и логгер
│   ├── types.ts               # TypeScript типы и интерфейсы
│   └── tests/                 # Тесты
│       └── delayed-switching.test.ts
├── example/                   # Примеры использования
│   ├── example.ts             # Основной пример с демонстрацией возможностей
│   ├── simple.ts              # Простой пример использования
│   ├── usage.ts               # Различные варианты использования
│   ├── serverless.ts          # Пример для serverless функций
│   ├── buffering-demo.ts      # Демонстрация буферизации запросов
│   ├── race-conditions-demo.ts # Демонстрация работы с race conditions
│   └── delayed-switching-demo.ts # Демонстрация отложенного переключения
├── configs/                   # VPN конфигурации
│   ├── example_vpn.ovpn
│   └── server2_vpn.ovpn
├── dist/                      # Скомпилированные JS файлы (создается при сборке)
├── config.json.example        # Пример файла конфигурации
├── package.json
├── tsconfig.json              # Конфигурация TypeScript
└── README.md
```

## 🛠️ Требования

- **Node.js** >= 20.0.0 (для нативной поддержки TypeScript)
- **npm** или **yarn**

## 📦 Установка

```bash
# Клонируем репозиторий
git clone <repository-url>
cd palivpn

# Устанавливаем зависимости
npm install

# Проверяем среду выполнения (опционально)
npm run check-env

# Копируем и настраиваем конфигурацию
cp .env.example .env
# Редактируем .env файл согласно вашим настройкам
```

## ⚙️ Конфигурация

### Файл конфигурации (config.json)

```json
{
  "vpnConfigsPath": "./configs",
  "defaultVpnTimeout": 30000,
  "maxReconnectAttempts": 3,
  "healthCheckInterval": 60000,
  "healthCheckUrl": "https://httpbin.org/ip",
  "healthCheckTimeout": 10000,
  "httpTimeout": 10000,
  "userAgent": "PaliVPN/1.0.0",
  "logLevel": "info",
  "nodeEnv": "development"
}
```

### Передача VPN конфигураций напрямую (для serverless)

```typescript
import { PaliVPN, VPNConfig } from './src/index';

const vpnConfigs: VPNConfig[] = [
    {
        name: 'server1',
        config: 'путь/к/server1.ovpn',
        priority: 1,
        active: false,
        type: 'openvpn'
    },
    {
        name: 'server2', 
        config: 'путь/к/server2.ovpn',
        priority: 2,
        active: false,
        type: 'openvpn'
    }
];

// Создание с предопределенными VPN конфигурациями
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
    logLevel: 'info',
    healthCheckInterval: 30000
});
```

## 🚀 Использование

### Способы запуска

**1. Нативный TypeScript (рекомендуется для разработки):**
```bash
# Запуск основного приложения
npm start                    # tsx src/index.ts

# Запуск в режиме разработки с автоперезагрузкой
npm run dev                  # tsx watch src/index.ts

# Запуск примера
npm run example              # tsx example/example.ts
```

**2. Скомпилированная версия (рекомендуется для продакшена):**
```bash
# Сборка проекта
npm run build

# Запуск скомпилированной версии
npm run start:compiled       # npm run build && node dist/index.js
npm run example:compiled     # npm run build && node dist/example/example.js
```

**3. Альтернативные способы (экспериментальные):**
```bash
# Через встроенную поддержку Node.js 20+ (может быть нестабильно)
npm run start:native         # node --import=tsx/esm src/index.ts
npm run example:native       # node --import=tsx/esm example/example.ts
```

### Основные команды

```bash
# Проверка среды выполнения
npm run check-env            # Проверка совместимости Node.js и зависимостей

# Запуск в обычном режиме (TypeScript)
npm start                    # tsx src/index.ts

# Запуск в режиме разработки (с автоперезагрузкой)
npm run dev                  # tsx watch src/index.ts

# Запуск примеров
npm run example              # tsx example/example.ts (основной пример)
npm run example:vpn-connection # Демонстрация VPN подключения к разным типам

# Сборка проекта
npm run build                # tsc

# Тестирование
npm test                     # tsx test-tsx.ts

# Очистка папки dist
npm run clean                # rm -rf dist
```

### Программное использование

**TypeScript/ES6:**
```typescript
import { VPNManager, VPNRequester, configManager } from './src/index';
import type { VPNConfig, AppConfig } from './src/types';

async function main(): Promise<void> {
    // Загружаем конфигурацию
    const appConfig: AppConfig = configManager.get();
    
    // Создаем и запускаем VPN менеджер
    const vpnManager = new VPNManager(appConfig);
    await vpnManager.initialize();
    await vpnManager.start();
    
    // Создаем HTTP клиент для запросов через VPN
    const requester = new VPNRequester(appConfig, vpnManager);
    
    // Выполняем запросы
    const response = await requester.request({
        url: 'https://httpbin.org/ip',
        method: 'GET'
    });
    
    const data = await response.json();
    console.log('Current IP:', data.origin);
    
    // Проверяем связность
    const connectivity = await requester.checkConnectivity();
    console.log('Connectivity:', connectivity);
}

main().catch(console.error);
```

**Простое использование через главный класс:**
```typescript
import { PaliVPN } from './src/index';

async function simpleExample(): Promise<void> {
    const vpnClient = new PaliVPN();
    
    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: 'https://httpbin.org/json',
            method: 'GET'
        });
        
        const data = await response.json();
        console.log('Response:', data);
        
    } finally {
        await vpnClient.stop();
    }
}
```
    console.log('Current IP:', ip);
    
    const response = await requester.request({
        url: 'https://httpbin.org/json',
        method: 'GET'
    });
    
    const data = await response.json();
    console.log('Response:', data);
}

main().catch(console.error);
```

**CommonJS (для скомпилированной версии):**
```javascript
const { VPNManager, VPNRequester, configManager } = require('./dist/index.js');

async function main() {
    // Загружаем конфигурацию
    const appConfig = configManager.get();
    
    // Создаем и запускаем VPN менеджер
    const vpnManager = new VPNManager(appConfig);
    await vpnManager.initialize();
    await vpnManager.start();
    
    // Создаем HTTP клиент для запросов через VPN
    const requester = new VPNRequester(appConfig, vpnManager);
    
    // Выполняем запросы
    const response = await requester.request({
        url: 'https://httpbin.org/ip',
        method: 'GET'
    });
    
    const data = await response.json();
    console.log('Current IP:', data.origin);
}

main().catch(console.error);
```

## 📊 API

### PaliVPN (главный класс)

Основной класс для работы с VPN клиентом.

```typescript
import { PaliVPN } from './src/index';

const client = new PaliVPN(config?, vpnConfigs?);

// Инициализация
await client.initialize();

// Выполнение HTTP запроса
const response = await client.request(requestConfig);

// Получение состояния
const isConnected = client.isConnected;
const currentVPN = client.currentVPN;

// Доступ к внутренним компонентам
const manager = client.manager;
const httpClient = client.httpClient;

// Остановка
await client.stop();

// Статический метод для создания с VPN конфигурациями
const client = PaliVPN.withVPNConfigs(vpnConfigs, config?);
```

### VPNManager

Менеджер VPN соединений с полной поддержкой OpenVPN, WireGuard и IKEv2.

```typescript
const manager = new VPNManager(config);

// Инициализация
await manager.initialize();

// Запуск
await manager.start();

// Подключение к конкретному VPN (полностью реализовано)
await manager.connect(vpn);

// Переключение VPN
await manager.switchVPN(targetVPN);

// Получение текущего VPN
const currentVPN = manager.currentVPN;

// Получение статуса работы
const isRunning = manager.isRunning;

// Получение полного статуса
const status = manager.getStatus();

// Остановка
await manager.stop();
```

**Поддерживаемые типы VPN:**
- **OpenVPN** - с поддержкой username/password аутентификации
- **WireGuard** - современный высокопроизводительный VPN
- **IKEv2** - через strongSwan клиент

**Конфигурации VPN:**
```typescript
const vpnConfigs: VPNConfig[] = [
    {
        name: 'openvpn-server',
        config: '/path/to/config.ovpn', // или inline конфигурация
        priority: 1,
        active: false,
        type: 'openvpn',
        auth: {
            username: 'user',
            password: 'password'
        }
    },
    {
        name: 'wireguard-server',
        config: '/path/to/wg0.conf', // или inline конфигурация
        priority: 2,
        active: false,
        type: 'wireguard'
    }
];
```

### VPNRequester

HTTP клиент для выполнения запросов через VPN.

```typescript
const requester = new VPNRequester(config, vpnManager);

// Основной метод для HTTP запросов
const response = await requester.request({
    url: 'https://example.com',
    method: 'GET',
    headers: { 'Custom-Header': 'value' },
    body: data // для POST/PUT запросов
});

// Утилиты
const ip = await requester.getCurrentIP();
const connectivity = await requester.checkConnectivity();
```

### HealthChecker

Мониторинг здоровья VPN соединений.

```typescript
const healthChecker = new HealthChecker(config);

// Инициализация
await healthChecker.initialize();

// Запуск мониторинга
healthChecker.start(vpnList);

// Разовая проверка
const result = await healthChecker.checkOnce(vpn);

// Остановка
healthChecker.stop();

// События
healthChecker.on('started', () => {});
healthChecker.on('stopped', () => {});
healthChecker.on('vpn:healthy', (vpn, status) => {});
healthChecker.on('vpn:unhealthy', (vpn, status) => {});
```

## 🔧 События

### VPNManager Events

```typescript
vpnManager.on('started', () => {
    console.log('VPN Manager started');
});

vpnManager.on('stopped', () => {
    console.log('VPN Manager stopped');
});

vpnManager.on('connected', (vpn: VPNConfig) => {
    console.log(`Connected to VPN: ${vpn.name}`);
});

vpnManager.on('disconnected', (vpn: VPNConfig) => {
    console.log(`Disconnected from VPN: ${vpn.name}`);
});

vpnManager.on('switched', (vpn: VPNConfig) => {
    console.log(`Switched to VPN: ${vpn.name}`);
});

// Дополнительные события для отложенного переключения
vpnManager.on('delayedSwitchScheduled', (switchRequest) => {
    console.log(`Switch scheduled: ${switchRequest.targetVPN.name}`);
});

vpnManager.on('delayedSwitchCancelled', (switchId, reason) => {
    console.log(`Switch cancelled: ${reason}`);
});
```

### HealthChecker Events

```typescript
healthChecker.on('started', () => {
    console.log('Health monitoring started');
});

healthChecker.on('stopped', () => {
    console.log('Health monitoring stopped');
});

healthChecker.on('vpn:healthy', (vpn: VPNConfig, status: VPNHealthStatus) => {
    console.log(`VPN ${vpn.name} is healthy`);
});

healthChecker.on('vpn:unhealthy', (vpn: VPNConfig, status: VPNHealthStatus) => {
    console.log(`VPN ${vpn.name} is unhealthy: ${status.reason}`);
});
```

## 🐛 Отладка

Для включения подробного логирования используйте конфигурацию:

```typescript
// Через параметры конструктора
const vpnClient = new PaliVPN({
    logLevel: 'debug'
});

// Через файл config.json
{
    "logLevel": "debug"
}
```

Уровни логирования:
- `error` - только ошибки
- `warn` - предупреждения и ошибки  
- `info` - информация, предупреждения и ошибки (по умолчанию)
- `debug` - все сообщения включая детальную отладку

## 📝 Разработка

### Требования

- Node.js >= 16.0.0
- npm >= 7.0.0

### Разработка

```bash
# Установка зависимостей для разработки
npm install

# Запуск в режиме разработки
npm run dev

# Запуск примеров
npm run example
```

### Тестирование

```bash
npm test
```

## 📄 Лицензия

MIT License - подробности в файле LICENSE.

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте ветку для новой функции (`git checkout -b feature/amazing-feature`)
3. Зафиксируйте изменения (`git commit -m 'Add amazing feature'`)
4. Отправьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📞 Поддержка

Если у вас есть вопросы или проблемы, пожалуйста:

1. Проверьте [Issues](https://github.com/your-repo/palivpn/issues)
2. Создайте новый Issue с подробным описанием проблемы
3. Приложите логи с уровнем `debug`

## 🌐 Serverless поддержка

PaliVPN поддерживает использование в serverless функциях без необходимости чтения файловой системы.

### Передача VPN конфигураций напрямую

```typescript
import { PaliVPN, VPNConfig } from './src/index';

// Предопределенные VPN конфигурации
const vpnConfigs: VPNConfig[] = [
    {
        name: 'server1',
        config: 'путь/к/server1.ovpn',
        priority: 1,
        active: false,
        type: 'openvpn'
    }
];

// Создание экземпляра с VPN конфигурациями
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, {
    logLevel: 'info',
    healthCheckInterval: 30000
});

// Или через конструктор
const vpnClient2 = new PaliVPN({
    logLevel: 'warn'
}, vpnConfigs);
```

### AWS Lambda пример

```typescript
export async function lambdaHandler(event: any, context: any) {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);

    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: 'https://httpbin.org/ip',
            method: 'GET'
        });
        
        const data = await response.json();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Success',
                vpnServer: vpnClient.currentVPN?.name,
                data: data
            })
        };
    } finally {
        await vpnClient.stop();
    }
}
```

### Vercel Edge Function пример

```typescript
export async function vercelEdgeHandler(request: Request) {
    const vpnClient = new PaliVPN({}, vpnConfigs);

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
    } finally {
        await vpnClient.stop();
    }
}
```

## 🔄 Дополнительные возможности

### Буферизация запросов

PaliVPN включает систему буферизации запросов с приоритетами:

```typescript
// Запросы автоматически буферизуются в VPNRequester
const response = await requester.request({
    url: 'https://example.com',
    method: 'GET',
    priority: 'high' // critical, high, normal, low
});
```

### Отложенное переключение каналов

```typescript
// Настройка отложенного переключения в конфигурации
const vpnClient = new PaliVPN({
    delayedSwitch: {
        enabled: true,
        defaultDelayMs: 5000,
        maxDelayMs: 30000
    }
});
```

### Управление параллелизмом

Встроенная поддержка мьютексов, семафоров и ReadWrite блокировок для безопасной работы с ресурсами.
