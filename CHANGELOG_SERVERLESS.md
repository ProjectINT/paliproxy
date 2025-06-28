# CHANGELOG - Serverless Support

## Новая функциональность: Поддержка Serverless

### 🎯 Цель
Добавлена возможность использования PaliVPN в serverless функциях без необходимости чтения файловой системы. Теперь VPN конфигурации можно передавать напрямую при инициализации.

### 🔧 Изменения в коде

#### 1. Обновлен тип `AppConfig` (`src/types.ts`)
```typescript
export interface AppConfig {
    // ...existing fields...
    vpnConfigs?: VPNConfig[]; // Новое поле для предопределенных VPN конфигураций
}
```

#### 2. Обновлен конструктор `PaliVPN` (`src/index.ts`)
```typescript
constructor(config?: Partial<AppConfig>, vpnConfigs?: VPNConfig[])
```
- Добавлен второй параметр для передачи VPN конфигураций
- Если переданы VPN конфигурации, они добавляются в конфиг

#### 3. Добавлен статический метод `withVPNConfigs()` (`src/index.ts`)
```typescript
static withVPNConfigs(vpnConfigs: VPNConfig[], config?: Partial<AppConfig>): PaliVPN
```
- Удобный способ создания экземпляра с предопределенными конфигурациями

#### 4. Обновлен `VPNManager.loadVPNConfigs()` (`src/manager.ts`)
```typescript
private async loadVPNConfigs(): Promise<void> {
    // Если VPN конфигурации переданы в config, используем их
    if (this.config.vpnConfigs && this.config.vpnConfigs.length > 0) {
        this.vpnList = [...this.config.vpnConfigs];
        logger.info(`Using ${this.vpnList.length} provided VPN configurations`);
        return;
    }
    
    // Иначе загружаем из файловой системы (legacy режим)
    // ...
}
```

### 📁 Новые файлы

#### 1. `example/serverless.ts`
- Примеры использования в AWS Lambda, Vercel Edge Functions
- Демонстрация работы с переменными окружения
- Обработка ошибок в serverless контексте

#### 2. `SERVERLESS_EXAMPLES.md`
- Подробная документация по serverless использованию
- Примеры для разных платформ (AWS, Vercel, Netlify, Cloudflare)
- Конфигурационные паттерны и best practices

### 📝 Обновленная документация

#### 1. `README.md`
- Добавлен раздел "Serverless поддержка"
- Примеры использования в Lambda и Edge Functions

#### 2. `USAGE.md`
- Обновлен с информацией о новых методах
- Примеры serverless использования

#### 3. `example/usage.ts`
- Добавлены новые функции: `serverlessExample()`, `minimalExample()`
- Поддержка аргументов командной строки для выбора режима

#### 4. `package.json`
- Новые npm скрипты:
  - `npm run example:serverless`
  - `npm run example:minimal`
  - `npm run example:serverless-demo`

### 🎯 Способы использования

#### Способ 1: Статический метод (рекомендуется)
```typescript
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, config);
```

#### Способ 2: Через конструктор
```typescript
const vpnClient = new PaliVPN(config, vpnConfigs);
// или
const vpnClient = new PaliVPN({ vpnConfigs: vpnConfigs, ...config });
```

### ✅ Тестирование

Все новые функции протестированы:
- `npm run example:minimal` - успешно
- `npm run example:serverless` - успешно
- Проверка типов TypeScript - без ошибок

### 🚀 Преимущества

1. **Serverless ready** - работает в Lambda, Edge Functions и других serverless окружениях
2. **Без файловой системы** - VPN конфигурации передаются в памяти
3. **Обратная совместимость** - старый способ загрузки из файлов продолжает работать
4. **Гибкость** - поддержка переменных окружения и разных способов конфигурации
5. **Type Safety** - полная поддержка TypeScript

### 📋 Пример AWS Lambda

```typescript
const vpnConfigs = [
    {
        name: 'lambda-vpn',
        config: process.env.VPN_CONFIG!,
        priority: 1,
        active: false
    }
];

export const handler = async (event, context) => {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);
    try {
        await vpnClient.initialize();
        const response = await vpnClient.request({ url: event.url });
        return { statusCode: 200, body: JSON.stringify(await response.json()) };
    } finally {
        await vpnClient.stop();
    }
};
```

## Новая функциональность: Буферизация запросов

### 🎯 Цель
Добавлена система буферизации HTTP запросов для обеспечения бесшовного переключения между VPN каналами без потери данных.

### 🔧 Изменения в коде

#### 1. Новые типы для буферизации (`src/types.ts`)
```typescript
export interface BufferedRequest {
    id: string;
    config: RequestConfig;
    timestamp: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    retryCount: number;
    maxRetries: number;
    resolve: (value: Response) => void;
    reject: (reason: any) => void;
    timeout?: NodeJS.Timeout;
}

export interface RequestBuffer {
    readonly size: number;
    readonly maxSize: number;
    readonly isProcessing: boolean;
    add(request: BufferedRequest): boolean;
    process(): Promise<void>;
    clear(): void;
    getStatus(): BufferStatus;
}
```

#### 2. Новый класс `RequestBuffer` (`src/requestBuffer.ts`)
- Управление очередью запросов с приоритизацией
- Автоматическая обработка буферизированных запросов
- Защита от переполнения буфера
- Статистика обработки запросов

#### 3. Обновлен `VPNRequester` (`src/requester.ts`)
- Интеграция с системой буферизации
- Новые методы с поддержкой приоритетов
- Автоматическое переключение в режим буферизации при сбоях VPN

#### 4. Обновлен интерфейс `IVPNRequester`
```typescript
requestWithBuffering(config: RequestConfig, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Response>;
getBufferStatus(): BufferStatus;
clearBuffer(): void;
stopBuffer(): void;
```

### 📁 Новые файлы

#### 1. `src/requestBuffer.ts`
- Полная реализация системы буферизации
- Приоритизация запросов
- Управление таймаутами и повторными попытками

#### 2. `example/buffering-demo.ts`
- Демонстрация работы буферизации
- Примеры с разными приоритетами
- Тестирование переключения VPN во время обработки запросов

### 🚀 Новые возможности

#### 1. Приоритизация запросов
```typescript
// Критически важный запрос
await requester.get('https://api.example.com/urgent', {}, 'critical');

// Обычный запрос
await requester.get('https://api.example.com/data', {}, 'normal');

// Низкоприоритетный запрос
await requester.get('https://api.example.com/logs', {}, 'low');
```

#### 2. Автоматическая буферизация при сбоях
```typescript
// Запрос автоматически буферизуется при недоступности VPN
const response = await requester.requestWithBuffering({
    url: 'https://api.example.com/data',
    method: 'POST',
    body: { important: 'data' }
}, 'high');
```

#### 3. Мониторинг состояния буфера
```typescript
const status = requester.getBufferStatus();
console.log(`Буфер: ${status.queueSize}/${status.maxSize} запросов`);
console.log(`Обработано: ${status.totalProcessed}, Ошибок: ${status.totalFailed}`);
```

### ✅ Тестирование

Новая функциональность протестирована:
- `npm run example:buffering` - демонстрация работы буферизации
- Проверка типов TypeScript - без ошибок
- Тестирование приоритизации и переключения VPN

### 🎯 Преимущества

1. **Надежность** - запросы не теряются при переключении VPN
2. **Приоритизация** - критически важные запросы обрабатываются первыми
3. **Производительность** - автоматическое управление очередью
4. **Мониторинг** - детальная статистика обработки
5. **Гибкость** - настраиваемые параметры буферизации

### 📋 Пример использования

```typescript
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);
await vpnClient.initialize();

const requester = vpnClient.httpClient;

// Отправляем запрос с высоким приоритетом
const response = await requester.post(
    'https://api.example.com/critical-data',
    { data: 'important' },
    {},
    'critical'
);

// Проверяем статус буфера
const bufferStatus = requester.getBufferStatus();
console.log('Buffer status:', bufferStatus);
```
