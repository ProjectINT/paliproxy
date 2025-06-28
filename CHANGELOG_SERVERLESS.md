````markdown
# CHANGELOG - Serverless Support

## Последние обновления (v2.0.0)

### 🚀 Отложенное переключение каналов (Delayed Channel Switching)
Реализована система умного переключения VPN каналов с учетом критичности операций и минимизации воздействия на пользовательский опыт.

#### 🎯 Возможности
- **Умное планирование переключений** с учетом приоритета и критичности операций
- **Защита критичных операций** от внезапных переключений
- **Буферизация и планирование** переключений на оптимальное время
- **Автоматическое управление** на основе анализа текущих операций
- **Гибкая конфигурация** пороговых значений и политик переключения

#### 🛠️ Новые компоненты

##### 1. `ChannelSwitchManager` (`src/channelSwitchManager.ts`)
```typescript
// Создание менеджера отложенного переключения
const switchManager = new ChannelSwitchManager({
    enabled: true,
    maxDelayMs: 300000, // 5 минут
    criticalityThresholds: {
        immediate: 90,  // Критичность >= 90 = немедленно
        fast: 70,      // Критичность >= 70 = быстро (1-5 сек)
        normal: 50,    // Критичность >= 50 = обычно (5-30 сек)
        slow: 30       // Критичность >= 30 = медленно (30+ сек)
    },
    gracePeriodMs: 30000 // Период ожидания завершения операций
});

// Запрос переключения
const switchId = await switchManager.requestSwitch(
    targetVPN,
    'optimization',  // Причина переключения
    'normal',        // Приоритет
    60              // Уровень критичности
);
```

##### 2. Интеграция с `VPNManager`
```typescript
// Конфигурация с отложенным переключением
const manager = new VPNManager({
    ...config,
    delayedSwitch: {
        enabled: true,
        maxDelayMs: 300000,
        criticalityThresholds: {
            immediate: 90,
            fast: 70,
            normal: 50,
            slow: 30
        },
        gracePeriodMs: 30000
    }
});

// Использование API отложенного переключения
const switchId = await manager.requestDelayedSwitch(
    vpnConfig, 
    'maintenance', 
    'low', 
    40
);

// Регистрация критичной операции
const operationId = await manager.registerOperation({
    type: 'file_transfer',
    criticalityLevel: 85,
    estimatedDuration: 60000,
    canInterrupt: false
});

// Завершение операции
await manager.completeOperation(operationId);

// Отмена переключения
await manager.cancelDelayedSwitch(switchId);
```

##### 3. Новые типы (`src/types.ts`)
```typescript
export interface DelayedSwitchConfig {
    enabled: boolean;
    maxDelayMs: number;
    criticalityThresholds: {
        immediate: number;
        fast: number;
        normal: number;
        slow: number;
    };
    gracePeriodMs: number;
}

export interface PendingSwitchRequest {
    id: string;
    targetVPN: VPNConfig;
    reason: SwitchReason;
    priority: SwitchPriority;
    requestedAt: number;
    scheduledAt: number;
    criticalityLevel: number;
    canCancel: boolean;
    metadata?: Record<string, any>;
}

export interface ActiveOperation {
    id: string;
    type: OperationType;
    criticalityLevel: number;
    startedAt: number;
    estimatedDuration: number;
    canInterrupt: boolean;
    onComplete?: () => void;
    onInterrupt?: () => void;
}

export type SwitchReason = 
    | 'health_check_failed' 
    | 'user_request' 
    | 'load_balancing' 
    | 'maintenance' 
    | 'emergency' 
    | 'optimization';

export type SwitchPriority = 'low' | 'normal' | 'high' | 'critical' | 'emergency';

export type OperationType = 
    | 'http_request' 
    | 'file_transfer' 
    | 'streaming' 
    | 'authentication' 
    | 'health_check' 
    | 'configuration_update';
```

#### 📊 События системы
```typescript
// События отложенного переключения
manager.on('delayedSwitchScheduled', (switchRequest) => {
    console.log(`Switch scheduled: ${switchRequest.id}`);
});

manager.on('delayedSwitchCancelled', (switchId, reason) => {
    console.log(`Switch cancelled: ${switchId} - ${reason}`);
});

// События менеджера переключений
switchManager.on('immediateSwitch', (switchRequest) => {
    console.log('Executing immediate switch');
});

switchManager.on('delayedSwitch', (switchRequest) => {
    console.log('Executing delayed switch');
});

switchManager.on('switchCompleted', (switchId, success) => {
    console.log(`Switch ${switchId}: ${success ? 'completed' : 'failed'}`);
});
```

#### 🔧 Примеры использования

##### Пример 1: Базовое использование
```typescript
import { VPNManager } from './src/manager';

const manager = new VPNManager({
    // ...обычная конфигурация...
    delayedSwitch: {
        enabled: true,
        maxDelayMs: 300000,
        criticalityThresholds: { immediate: 90, fast: 70, normal: 50, slow: 30 },
        gracePeriodMs: 30000
    }
});

await manager.initialize();
await manager.start();

// Запрос переключения низкого приоритета
await manager.requestDelayedSwitch(backupVPN, 'optimization', 'low', 40);

// Запрос экстренного переключения
await manager.requestDelayedSwitch(emergencyVPN, 'emergency', 'emergency', 95);
```

##### Пример 2: Управление операциями
```typescript
// Регистрация критичной операции
const downloadId = await manager.registerOperation({
    type: 'file_transfer',
    criticalityLevel: 85,
    estimatedDuration: 120000, // 2 минуты
    canInterrupt: false
});

// Во время операции переключения будут отложены
await manager.requestDelayedSwitch(newVPN, 'maintenance', 'normal', 60);

// По завершении операции
await manager.completeOperation(downloadId);
// Теперь отложенные переключения могут выполниться
```

### 🛠️ Защита от состояний гонки (Race Conditions Protection)

#### Новые примитивы синхронизации (`src/concurrency.ts`)
- **`AsyncMutex`** - асинхронный мьютекс для последовательного выполнения
- **`AsyncSemaphore`** - семафор для ограничения параллельных операций  
- **`AsyncReadWriteLock`** - блокировка чтения/записи для оптимизации доступа к данным
- **`AsyncCondition`** - условная переменная для координации потоков

#### Интеграция в основные компоненты
- **VPNManager**: мьютексы для переключения, загрузки конфигов, health-check
- **VPNRequester**: семафор для ограничения параллельных запросов
- **RequestBuffer**: мьютекс для обработки буфера запросов
- **ChannelSwitchManager**: мьютексы для переключений и операций

### 🎛️ Система буферизации запросов (Request Buffering)

#### Компонент `RequestBuffer` (`src/requestBuffer.ts`)
```typescript
// Создание буфера с приоритизацией
const buffer = new RequestBuffer({
    maxSize: 1000,
    maxConcurrent: 5,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    autoProcess: true,
    autoProcessInterval: 1000
});

// Добавление запроса с приоритетом
await buffer.add({
    id: 'req-1',
    url: 'https://api.example.com/data',
    method: 'GET',
    priority: 'high',
    timeout: 10000
});
```

#### Автоматическая интеграция с `VPNRequester`
- Буферизация при сбоях VPN соединения
- Приоритизация критичных запросов
- Автоматическое повторное выполнение при восстановлении соединения

---

## Предыдущие обновления

### 🚀 Поддержка Serverless (v1.0.0)

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

---

## 🔄 Отложенное переключение каналов (v3.0.0)

### 🎯 Обзор
Система отложенного переключения каналов обеспечивает интеллектуальное управление переключением VPN с учетом:
- **Критичности активных операций** - переключение откладывается во время важных операций
- **Приоритета запросов** - экстренные переключения выполняются немедленно
- **Пользовательского опыта** - минимизация прерываний работы пользователя
- **Типобезопасных событий** - полный контроль над процессом переключения

### 🚀 Новые возможности

#### 1. Менеджер отложенного переключения (`src/channelSwitchManager.ts`)
```typescript
export class ChannelSwitchManager {
    // Интеллектуальный запрос переключения
    async requestSwitch(
        targetVPN: VPNConfig,
        reason: SwitchReason,
        priority: SwitchPriority,
        criticalityLevel?: number
    ): Promise<string>;
    
    // Регистрация активных операций
    registerOperation(operation: Omit<ActiveOperation, 'id'>): string;
    completeOperation(operationId: string): void;
    
    // Отмена переключений
    cancelSwitch(switchId: string): boolean;
    
    // Анализ оптимального времени
    getOptimalSwitchTime(): number;
    getSwitchDecision(targetVPN: VPNConfig, reason: SwitchReason, priority: SwitchPriority): SwitchDecision;
}
```

#### 2. Интеграция с `VPNManager`
```typescript
// Новые методы VPNManager
async requestDelayedSwitch(
    targetVPN: VPNConfig, 
    reason: SwitchReason, 
    priority: SwitchPriority, 
    criticalityLevel?: number
): Promise<string>;

async registerOperation(operation: Partial<ActiveOperation>): Promise<string>;
async completeOperation(operationId: string): Promise<void>;
getDelayedSwitchStatus(): DelayedSwitchStatus;
```

#### 3. Конфигурация отложенного переключения
```typescript
interface DelayedSwitchConfig {
    enabled: boolean;
    maxDelayMs: number;                    // Максимальная задержка
    criticalityThresholds: {
        immediate: number;    // >= 90 - немедленно
        fast: number;        // 70-89 - быстро (1-5 сек)
        normal: number;      // 50-69 - обычно (5-30 сек)
        slow: number;        // 30-49 - медленно (30+ сек)
    };
    gracePeriodMs: number;    // Период ожидания завершения операций
}
```

#### 4. Типы операций и приоритетов
```typescript
type SwitchPriority = 'low' | 'normal' | 'high' | 'critical' | 'emergency';
type SwitchReason = 'health_check_failed' | 'user_request' | 'load_balancing' 
                  | 'maintenance' | 'emergency' | 'optimization';
type OperationType = 'http_request' | 'file_transfer' | 'streaming' 
                   | 'authentication' | 'health_check' | 'configuration_update';
```

### 🔧 Настройка

#### Базовая конфигурация
```typescript
const config: AppConfig & { delayedSwitch: DelayedSwitchConfig } = {
    // ... обычная конфигурация VPN
    delayedSwitch: {
        enabled: true,
        maxDelayMs: 60000,
        criticalityThresholds: {
            immediate: 90,
            fast: 70,
            normal: 50,
            slow: 30
        },
        gracePeriodMs: 10000
    }
};

const manager = new VPNManager(config);
```

### 📋 Примеры использования

#### 1. Простое отложенное переключение
```typescript
// Запрос переключения с низким приоритетом
const switchId = await manager.requestDelayedSwitch(
    backupVPN,
    'optimization',
    'low',
    40 // Уровень критичности
);

console.log(`Переключение запланировано: ${switchId}`);
```

#### 2. Регистрация критичной операции
```typescript
// Регистрируем важную файловую операцию
const operationId = await manager.registerOperation({
    type: 'file_transfer',
    criticalityLevel: 85,
    estimatedDuration: 30000,
    canInterrupt: false,
    onComplete: () => console.log('Загрузка завершена'),
    onInterrupt: () => console.log('Загрузка прервана!')
});

// Переключение будет отложено до завершения операции
const switchId = await manager.requestDelayedSwitch(
    newVPN,
    'user_request',
    'normal',
    60
);

// Завершаем операцию
await manager.completeOperation(operationId);
```

#### 3. Экстренное переключение
```typescript
// Экстренное переключение (выполняется немедленно)
const emergencySwitchId = await manager.requestDelayedSwitch(
    emergencyVPN,
    'emergency',
    'emergency',
    95 // Критичность >= 90
);
```

#### 4. Мониторинг состояния
```typescript
const status = manager.getDelayedSwitchStatus();
console.log('Отложенное переключение включено:', status.isEnabled);
console.log('Ожидающих переключений:', status.pendingSwitches.length);
console.log('Активных операций:', status.activeOperations.length);

if (status.nextScheduledSwitch) {
    console.log(`Следующее переключение через ${status.nextScheduledSwitch.timeUntilSwitch}ms`);
}
```

#### 5. События переключения
```typescript
// Подписываемся на события
manager.on('delayedSwitchScheduled', (switchRequest) => {
    console.log(`Переключение запланировано на ${new Date(switchRequest.scheduledAt)}`);
});

manager.on('delayedSwitchCancelled', (switchId, reason) => {
    console.log(`Переключение ${switchId} отменено: ${reason}`);
});
```

### 🧪 Тестирование

```bash
# Запуск демонстрации отложенного переключения
npm run example:delayed-switching

# Запуск тестов
npm run test:delayed-switching
```

### 🎛️ Логика принятия решений

Система анализирует несколько факторов при принятии решения о переключении:

1. **Критичность запроса** (0-100):
   - `>= 90` - Немедленное переключение
   - `70-89` - Быстрое переключение (1-5 сек)
   - `50-69` - Обычное переключение (5-30 сек)
   - `30-49` - Медленное переключение (30+ сек)
   - `< 30` - Откладывается до лучшего времени

2. **Активные операции**:
   - Критичные операции (критичность >= 80) блокируют переключение
   - Некритичные операции могут быть прерваны при необходимости

3. **Приоритет переключения**:
   - `emergency` - игнорирует все ограничения
   - `critical` - прерывает некритичные операции
   - `high` - ждет завершения критичных операций
   - `normal/low` - ждет оптимального времени

## ✅ ИНТЕГРАЦИЯ ЗАВЕРШЕНА - Отложенное переключение каналов

### 🎯 Полная интеграция реализована:

#### 1. **VPNManager с поддержкой отложенного переключения**
   - ✅ **Конструктор обновлен** для поддержки `DelayedSwitchConfig`
   - ✅ **Методы интерфейса реализованы**: `requestDelayedSwitch()`, `cancelDelayedSwitch()`, `registerOperation()`, `completeOperation()`, `getDelayedSwitchStatus()`
   - ✅ **Автоматическая интеграция** с health check и восстановлением
   - ✅ **Обработчики событий** для мониторинга переключений

#### 2. **Улучшенная обработка сбоев**
   ```typescript
   // При сбое VPN теперь используется отложенное переключение
   private async handleUnhealthyVPN(vpn: VPNConfig): Promise<void> {
       // Если доступно отложенное переключение - используем его
       if (this._channelSwitchManager) {
           await this.requestDelayedSwitch(
               bestAlternativeVPN,
               'health_check_failed',
               'high',
               80 // Высокая критичность для сбоев
           );
       } else {
           // Fallback к немедленному переключению
           await this.connectToBestVPN();
       }
   }
   ```

#### 3. **Демонстрация и тестирование**
   - ✅ **Демо скрипт**: `example/delayed-switching-demo.ts` - полная демонстрация всех возможностей
   - ✅ **Тесты**: `src/tests/delayed-switching.test.ts` - модульные и интеграционные тесты
   - ✅ **npm скрипты**: `npm run example:delayed-switching`, `npm run test:delayed-switching`

#### 4. **Практическое использование**
   ```typescript
   // Инициализация с поддержкой отложенного переключения
   const manager = new VPNManager({
       // ...обычная конфигурация...
       delayedSwitch: {
           enabled: true,
           maxDelayMs: 60000,
           criticalityThresholds: { immediate: 90, fast: 70, normal: 50, slow: 30 },
           gracePeriodMs: 10000
       }
   });

   // Регистрация критичной операции
   const opId = await manager.registerOperation({
       type: 'file_transfer',
       criticalityLevel: 85,
       estimatedDuration: 30000,
       canInterrupt: false
   });

   // Запрос отложенного переключения
   const switchId = await manager.requestDelayedSwitch(
       targetVPN, 'optimization', 'normal', 60
   );

   // Мониторинг
   const status = manager.getDelayedSwitchStatus();
   console.log('Pending switches:', status.pendingSwitches.length);
   ```

### 📊 Результаты тестирования

**Демонстрация показала:**
- ✅ Правильное планирование переключений по приоритетам
- ✅ Защиту критичных операций от прерывания
- ✅ Немедленное выполнение аварийных переключений
- ✅ Корректную отмену запланированных переключений
- ✅ Автоматическое переключение при завершении операций

**Тесты подтвердили:**
- ✅ Корректную работу всех основных функций
- ✅ Интеграцию с существующими компонентами
- ✅ Обработку edge cases и ошибок
- ✅ Типобезопасность и стабильность API

### 🏆 Итоговый результат

**Система отложенного переключения каналов полностью реализована и интегрирована!**

Основные достижения:
- **Защита от race conditions** ✅
- **Буферизация запросов** ✅  
- **Отложенное переключение каналов** ✅
- **Интеллектуальное управление критичными операциями** ✅
- **Полная интеграция с VPNManager** ✅
- **Типобезопасные события и API** ✅
- **Comprehensive testing и демонстрация** ✅

Система готова к production использованию! 🚀

### 📊 Преимущества

- ✅ **Минимизация прерываний**: Критичные операции защищены от неожиданных переключений
- ✅ **Гибкость приоритетов**: Поддержка экстренных и плановых переключений
- ✅ **Умное планирование**: Автоматический выбор оптимального времени переключения
- ✅ **Полный контроль**: Возможность отмены и мониторинга переключений
- ✅ **Типобезопасность**: Строгая типизация всех операций и событий
- ✅ **Интеграция**: Бесшовная работа с существующей системой VPN
````
