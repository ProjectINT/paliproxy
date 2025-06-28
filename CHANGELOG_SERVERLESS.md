````markdown
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

## Новая функциональность: Защита от Race Conditions

### 🎯 Цель
Добавлена комплексная система защиты от состояний гонки (race conditions) при асинхронной работе с VPN каналами с использованием мьютексов, семафоров и блокировок.

### 🔧 Изменения в коде

#### 1. Новый модуль синхронизации (`src/concurrency.ts`)
```typescript
export class AsyncMutex {
    async acquire(): Promise<void>;
    release(): void;
    async runWithLock<T>(fn: () => Promise<T>): Promise<T>;
    isLocked(): boolean;
    getQueueSize(): number;
}

export class AsyncSemaphore {
    async acquire(): Promise<void>;
    release(): void;
    async runWithPermit<T>(fn: () => Promise<T>): Promise<T>;
    getAvailablePermits(): number;
    getQueueSize(): number;
}

export class AsyncReadWriteLock {
    async acquireRead(): Promise<void>;
    async acquireWrite(): Promise<void>;
    releaseRead(): void;
    releaseWrite(): void;
    async runWithReadLock<T>(fn: () => Promise<T>): Promise<T>;
    async runWithWriteLock<T>(fn: () => Promise<T>): Promise<T>;
}
```

#### 2. Обновлен `VPNManager` (`src/manager.ts`)
- **Мьютексы для критических операций**:
  - `vpnSwitchingMutex` - защита переключения VPN
  - `configLoadingMutex` - защита загрузки конфигураций
  - `healthCheckingMutex` - защита проверок здоровья
- **Семафоры для ограничения параллелизма**:
  - `maxVPNConnections` - только одно подключение одновременно
- **ReadWrite блокировки**:
  - `vpnListLock` - защита списка VPN конфигураций

#### 3. Обновлен `VPNRequester` (`src/requester.ts`)
- **Семафор для HTTP запросов**: `maxConcurrentRequests` (лимит 10)
- **Мьютекс для критических операций**: `requestProcessingMutex`
- Защита от одновременного выполнения VPN fallback операций

#### 4. Новые типы для мониторинга (`src/types.ts`)
```typescript
export interface ConcurrencyStatus {
    mutexes: {
        vpnSwitching: boolean;
        configLoading: boolean;
        healthChecking: boolean;
        requestProcessing: boolean;
    };
    semaphores: {
        maxConcurrentRequests: {
            available: number;
            total: number;
            queue: number;
        };
        maxVPNConnections: {
            available: number;
            total: number;
            queue: number;
        };
    };
    locks: {
        vpnList: {
            readers: number;
            writers: number;
            readQueue: number;
            writeQueue: number;
        };
    };
}
```

### 📁 Новые файлы

#### 1. `src/concurrency.ts`
- Полная реализация примитивов синхронизации
- AsyncMutex - для взаимного исключения
- AsyncSemaphore - для ограничения параллелизма
- AsyncReadWriteLock - для эффективного чтения/записи
- AsyncCondition - для ожидания условий

#### 2. `example/race-conditions-demo.ts`
- Демонстрация защиты от race conditions
- Стресс-тесты множественных переключений VPN
- Примеры использования разных примитивов синхронизации

### 🚀 Новые возможности

#### 1. Безопасное переключение VPN
```typescript
// Множественные одновременные переключения защищены мьютексом
await Promise.all([
    manager.switchVPN(vpn1),
    manager.switchVPN(vpn2), 
    manager.switchVPN(vpn3)
]); // Выполнятся последовательно, без конфликтов
```

#### 2. Контроль параллелизма HTTP запросов
```typescript
// Максимум 10 одновременных запросов
const requests = Array.from({length: 20}, () => 
    requester.get('https://api.example.com/data')
); // Будут выполняться группами по 10
```

#### 3. Безопасный доступ к конфигурациям
```typescript
// Безопасное чтение списка VPN
const vpnList = await manager.vpnListLock.runWithReadLock(async () => {
    return [...manager.vpnList]; // Защищено от изменений
});
```

#### 4. Мониторинг состояния синхронизации
```typescript
const status = manager.getConcurrencyStatus();
console.log('Заблокированные мьютексы:', status.mutexes);
console.log('Очереди семафоров:', status.semaphores);
console.log('Активные блокировки:', status.locks);
```

### ✅ Тестирование

Новая функциональность протестирована:
- `npm run example:race-conditions` - демонстрация защиты от race conditions
- Стресс-тесты параллельных операций
- Проверка отсутствия deadlock'ов
- Валидация корректного освобождения ресурсов

### 🎯 Преимущества

1. **Безопасность** - полная защита от race conditions
2. **Производительность** - оптимальное использование ресурсов
3. **Надежность** - предотвращение deadlock'ов и зависаний
4. **Мониторинг** - детальная информация о состоянии синхронизации
5. **Масштабируемость** - контролируемый параллелизм

### 🛡️ Защищенные операции

- ✅ Переключение между VPN каналами
- ✅ Загрузка и изменение конфигураций
- ✅ Проверки здоровья VPN
- ✅ HTTP запросы с ограничением параллелизма
- ✅ Управление состоянием VPN списка
- ✅ Обработка сбоев и восстановление

### 📋 Пример использования

```typescript
const manager = client.manager;

// Получаем статус синхронизации
const concurrencyStatus = manager.getConcurrencyStatus();
console.log('Синхронизация:', concurrencyStatus);

// Безопасное переключение VPN (защищено мьютексом)
await manager.switchVPN(newVPN);

// Контролируемые параллельные запросы (семафор)
const responses = await Promise.all(
    Array.from({length: 15}, () => requester.get(url))
); // Максимум 10 одновременно
```
````
