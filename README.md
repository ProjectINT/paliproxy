# PaliVPN

Автоматический VPN клиент с мониторингом здоровья соединений и переключением туннелей.

## 🚀 Особенности

- **Автоматическое управление VPN соединениями** - подключение к лучшему доступному серверу
- **Мониторинг здоровья туннелей** - постоянная проверка доступности и качества соединения
- **Автоматическое переключение** - смена VPN при проблемах с текущим соединением
- **HTTP клиент с проксированием** - выполнение запросов через активный VPN туннель (используя нативный fetch API)
- **Простой API** - единый класс с методом `request()` для выполнения HTTP запросов через VPN
- **Гибкая конфигурация** - настройка через env файлы, аргументы командной строки или файлы конфигурации
- **Подробное логирование** - отслеживание всех операций и ошибок
- **TypeScript поддержка** - типизированные интерфейсы для разработки

## 💡 Быстрый старт

```typescript
import PaliVPN from 'palivpn';

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
│   ├── index.ts               # Точка входа: инициализация VPN клиента
│   ├── manager.ts             # Логика подключения и переключения
│   ├── config.ts              # Загрузка конфигов из env, файла или аргументов
│   ├── healthChecker.ts       # Проверка доступности туннелей
│   ├── requester.ts           # Проксирующий HTTP-запрос через активный VPN
│   ├── utils.ts               # Вспомогательные функции
│   └── types.ts               # TypeScript типы и интерфейсы
├── example/
│   └── example.ts             # Пример использования
├── dist/                      # Скомпилированные JS файлы (создается при сборке)
├── .env                       # Основной источник конфигов
├── .gitignore
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

### Переменные окружения (.env)

```bash
# Environment Configuration
NODE_ENV=development

# VPN Configuration
VPN_CONFIGS_PATH=./configs
DEFAULT_VPN_TIMEOUT=30000
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_URL=https://httpbin.org/ip

# HTTP Configuration  
HTTP_TIMEOUT=10000
USER_AGENT=PaliVPN/1.0.0

# Logging
LOG_LEVEL=info
```

### Аргументы командной строки

```bash
npm start -- --config-path ./my-configs --timeout 45000 --log-level debug
```

### Файл конфигурации (config.json)

```json
{
  "vpnConfigsPath": "./configs",
  "defaultVpnTimeout": 30000,
  "healthCheckInterval": 60000,
  "logLevel": "info"
}
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

# Запуск примера
npm run example              # tsx example/example.ts

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
import { VPNManager } from './src/manager.js';
import { VPNRequester } from './src/requester.js';
import { loadConfig } from './src/config.js';
import type { VPNConfig, VPNInfo } from './src/types.js';

async function main(): Promise<void> {
    // Загружаем конфигурацию
    const vpnConfig: VPNConfig = await loadConfig();
    
    // Создаем и запускаем VPN менеджер
    const vpnManager = new VPNManager(vpnConfig);
    await vpnManager.initialize();
    await vpnManager.start();
    
    // Создаем HTTP клиент для запросов через VPN
    const requester = new VPNRequester(vpnConfig, vpnManager);
    
    // Выполняем запросы
    const ip = await requester.getCurrentIP();
    console.log('Current IP:', ip);
    
    const response = await requester.get('https://httpbin.org/json');
    console.log('Response:', response.data);
}

main().catch(console.error);
```

**CommonJS (для скомпилированной версии):**
```javascript
const { VPNManager } = require('./dist/manager.js');
const { VPNRequester } = require('./dist/requester.js');
const { loadConfig } = require('./dist/config.js');

async function main() {
    // Загружаем конфигурацию
    const vpnConfig = await loadConfig();
    
    // Создаем и запускаем VPN менеджер
    const vpnManager = new VPNManager(vpnConfig);
    await vpnManager.initialize();
    await vpnManager.start();
    
    // Создаем HTTP клиент для запросов через VPN
    const requester = new VPNRequester(vpnConfig, vpnManager);
    
    // Выполняем запросы
    const ip = await requester.getCurrentIP();
    console.log('Current IP:', ip);
    
    const response = await requester.get('https://httpbin.org/json');
    console.log('Response:', response.data);
}

main().catch(console.error);
```

## 📊 API

### VPNManager

Основной класс для управления VPN соединениями.

```javascript
const manager = new VPNManager(config);

// Инициализация
await manager.initialize();

// Запуск
await manager.start();

// Подключение к конкретному VPN
await manager.connect(vpn);

// Переключение VPN
await manager.switchVPN(targetVPN);

// Получение статуса
const status = manager.getStatus();

// Остановка
await manager.stop();
```

### VPNRequester

HTTP клиент для выполнения запросов через VPN.

```javascript
const requester = new VPNRequester(config, vpnManager);

// HTTP методы
const response = await requester.get(url);
const response = await requester.post(url, data);
const response = await requester.put(url, data);
const response = await requester.delete(url);

// Утилиты
const ip = await requester.getCurrentIP();
const connectivity = await requester.checkConnectivity();

// Batch запросы
const results = await requester.batchRequests(requests, concurrency);

// Запрос с автоматическим переключением VPN
const response = await requester.requestWithVPNFallback(config);
```

### HealthChecker

Мониторинг здоровья VPN соединений.

```javascript
const healthChecker = new HealthChecker(config);

// Инициализация
await healthChecker.initialize();

// Запуск мониторинга
healthChecker.start(vpnList);

// Разовая проверка
const result = await healthChecker.checkOnce(vpn);

// События
healthChecker.on('vpn:healthy', (vpn, status) => {
    console.log(`VPN ${vpn.name} is healthy`);
});

healthChecker.on('vpn:unhealthy', (vpn, status) => {
    console.log(`VPN ${vpn.name} is unhealthy: ${status.reason}`);
});
```

## 🔧 События

### VPNManager Events

```javascript
vpnManager.on('started', () => {});
vpnManager.on('stopped', () => {});
vpnManager.on('connected', (vpn) => {});
vpnManager.on('disconnected', (vpn) => {});
vpnManager.on('switched', (vpn) => {});
```

### HealthChecker Events

```javascript
healthChecker.on('vpn:healthy', (vpn, status) => {});
healthChecker.on('vpn:unhealthy', (vpn, status) => {});
```

## 🐛 Отладка

Для включения подробного логирования:

```bash
# Через переменную окружения
LOG_LEVEL=debug npm start

# Через аргумент командной строки
npm start -- --log-level debug
```

Уровни логирования:
- `error` - только ошибки
- `warn` - предупреждения и ошибки
- `info` - информация, предупреждения и ошибки (по умолчанию)
- `debug` - все сообщения

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

PaliVPN поддерживает использование в serverless функциях (AWS Lambda, Vercel Edge Functions и т.д.) без необходимости чтения файловой системы.

### Передача VPN конфигураций напрямую

```typescript
import { PaliVPN, VPNConfig } from 'palivpn';

// Предопределенные VPN конфигурации
const vpnConfigs: VPNConfig[] = [
    {
        name: 'server1',
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
    vpnConfigs: vpnConfigs,
    logLevel: 'warn'
});
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
    const vpnClient = new PaliVPN({ vpnConfigs: vpnConfigs });

    try {
        await vpnClient.initialize();
        
        const response = await vpnClient.request({
            url: 'https://api.ipify.org?format=json'
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
