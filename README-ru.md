# proxy-connection

Модуль для управления пулом прокси с автоматическим health-check, балансировкой, логированием и поддержкой Dante.

## Архитектура

- **ProxyManager** — основной класс для работы с пулом прокси. Поддерживает автоматическую проверку живости, балансировку по задержке, повторные попытки, ведёт стек запросов и историю попыток.
- **Dante** — интеграция с [Dante Socks5 Proxy](https://www.inet.no/dante/) для автоматического управления и настройки socks5-прокси через скрипты и конфиги (см. папку `dante/`).
- **Logger** — модуль логирования с поддержкой Sentry и расширяемым интерфейсом (см. `src/utils/logger`). Все ошибки и события прокидываются через логгер.
- **SnowflakeId** — генерация уникальных идентификаторов для запросов (см. `src/utils/snowflakeId`).
- **Тестирование прокси** — асинхронная проверка доступности и задержки для каждого прокси (см. `src/utils/testProxy`).
- **Балансировка** — выбор следующего прокси по минимальной задержке и политике повторов (см. `src/utils/getNextProxy`).

## Использование

0. (опционально) Запустите скрипт для установки прокси на ваш ubuntu сервер

```sh
ssh root@255.255.255.255 'bash -s' < ./dante/setup-dante.sh "your pass for proxy auth"
```

1. Установите пакет:

```sh
npm install proxy-connection
```

2. Пример использования с новым fetch-подобным API:

```typescript
import { ProxyManager } from 'proxy-connection';

const proxies = [
  { ip: '1.2.3.4', port: 1080, user: 'user', pass: 'pass' },
  // ...
];

const manager = new ProxyManager(proxies, {
  config: {
    healthCheckUrl: 'https://example.com/ping',
    healthCheckInterval: 30000,
    maxTimeout: 10000,
    changeProxyLoop: 2,
    // ...
  },
  sentryLogger: myLoggerInstance, // опционально
  disableLogging: false, // опционально - установите в true для отключения всего логирования
});

// Новый fetch-подобный API (рекомендуется)
const response = await manager.request('https://api.ipify.org');
const ip = await response.text();

// С опциями (точно как fetch)
const response = await manager.request('https://httpbin.org/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' })
});

if (response.ok) {
  const data = await response.json();
  console.log(data);
}
```

### Совместимость с Fetch API

ProxyManager теперь поддерживает fetch-подобный API для лёгкой миграции с `fetch()`:

```typescript
// Раньше (стандартный fetch)
const response = await fetch(url, options);

// Теперь (с ProxyManager)
const response = await manager.request(url, options);
```

Объект response поддерживает те же методы, что и fetch:
- `response.text()` - получить ответ как текст
- `response.json()` - разобрать ответ как JSON
- `response.ok` - логическое значение, указывающее на успех (статус 200-299)
- `response.status` - HTTP код статуса
- `response.statusText` - HTTP сообщение статуса

### Интеграция с OpenAI SDK

ProxyManager может использоваться как прямая замена fetch в OpenAI SDK. Менеджер автоматически обрабатывает конвертацию Headers и поддерживает полную совместимость с fetch API:

```typescript
import OpenAI from 'openai';
import { ProxyManager } from 'proxy-connection';

const manager = new ProxyManager(proxies, {
  config: {
    healthCheckUrl: 'https://httpbin.org/ip',
    maxTimeout: 30000, // OpenAI запросы могут занимать больше времени
    changeProxyLoop: 3,
  }
});

// Используем ProxyManager как замену fetch в OpenAI клиенте
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: manager.request // .bind() не нужен
});

// Все методы OpenAI SDK теперь работают через ваш пул прокси
const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Привет!" }],
});

const models = await openai.models.list();
const embeddings = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: "Ваш текст здесь",
});
```

#### Ключевые особенности для интеграции с OpenAI:

- **Автоматическая конвертация Headers**: ProxyManager автоматически конвертирует Headers-объекты OpenAI SDK в обычные объекты
- **Полная совместимость с Fetch**: Поддерживает все возможности fetch API, используемые OpenAI SDK
- **Автопривязанные методы**: Не нужен `.bind(manager)` - метод request автоматически привязан в конструкторе
- **Обработка ошибок**: Сбои прокси обрабатываются прозрачно с автоматическим переключением на другие прокси
- **Логирование запросов**: Все OpenAI запросы логируются (когда логирование включено) для отладки

#### Альтернативное использование (с явной привязкой):

Если вы предпочитаете явную привязку или используете старую версию:

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: manager.request.bind(manager) // Явная привязка
});
```

#### Конфигурация для OpenAI:

Рекомендуемая конфигурация для запросов к OpenAI API:

```typescript
const manager = new ProxyManager(proxies, {
  config: {
    maxTimeout: 60000,           // OpenAI запросы могут занимать до 60 секунд
    healthCheckInterval: 120000, // Проверять прокси каждые 2 минуты
    changeProxyLoop: 2,          // Пробовать каждый прокси дважды перед отказом
    onErrorRetries: 1,           // Повторить один раз при сетевых ошибках
    onTimeoutRetries: 0,         // Не повторять таймауты (сразу переключать прокси)
  }
});
```

## Dante

- Папка `dante/` содержит скрипты и инструкции для автоматической настройки socks5-прокси через Dante.
- Используйте `setup-dante.sh` для быстрой установки и конфигурирования.
- Прокси в пуле могут быть как внешними, так и локальными через Dante.

## Logger

- По умолчанию используется встроенный логгер с поддержкой Sentry.
- Можно передать свой логгер, реализующий интерфейс `ISentryLogger`.
- **Логирование можно полностью отключить**, установив `disableLogging: true` в опциях.
- Все ошибки, попытки и события логируются (когда логирование включено).

### Примеры конфигурации логгера

```typescript
// Поведение по умолчанию - встроенный логгер с поддержкой Sentry
const manager = new ProxyManager(proxies);

// Использование кастомного Sentry логгера
const manager = new ProxyManager(proxies, {
  sentryLogger: myCustomSentryLogger
});

// Полностью отключить логирование (без логов, без Sentry, лучшая производительность)
const manager = new ProxyManager(proxies, {
  disableLogging: true
});

// Отключить логирование с кастомной конфигурацией
const manager = new ProxyManager(proxies, {
  disableLogging: true,
  config: {
    maxTimeout: 5000,
    healthCheckInterval: 60000,
    // ... другие опции конфигурации
  }
});
```

## Конфигурация

ProxyManager принимает объект конфигурации с различными опциями для управления поведением прокси, проверками здоровья, повторными попытками и таймаутами.

### Полная справка по конфигурации

```typescript
const manager = new ProxyManager(proxies, {
  config: {
    // Поведение повторных попыток
    onErrorRetries: 0,           // Количество повторов при ошибке перед переключением прокси (по умолчанию: 0)
    onTimeoutRetries: 0,         // Количество повторов при таймауте перед переключением прокси (по умолчанию: 0)
    
    // Таймауты
    maxTimeout: 5000,            // Максимальный таймаут запроса в миллисекундах (по умолчанию: 5000)
    
    // Настройки проверки здоровья
    healthCheckUrl: 'https://httpbin.org/ip',     // URL для проверки здоровья прокси (по умолчанию: из env или 'https://httpbin.org/ip')
    healthCheckInterval: 60000,   // Интервал проверки здоровья в миллисекундах (по умолчанию: 60000)
    
    // Поведение переключения прокси
    changeProxyLoop: 2,          // Количество циклов смены прокси - попытки на прокси (по умолчанию: 2)
  },
  
  // Опции логгера
  sentryLogger: myLoggerInstance,  // Опциональный кастомный Sentry логгер
  disableLogging: false,           // Установить в true для отключения всего логирования (по умолчанию: false)
});
```

### Описание полей конфигурации

#### Настройки повторных попыток

- **`onErrorRetries`** (число, по умолчанию: `0`)
  - Количество попыток повтора при ошибке запроса
  - Установите в `0` для немедленного переключения на следующий прокси при ошибке
  - Большие значения будут повторять тот же прокси перед переключением

- **`onTimeoutRetries`** (число, по умолчанию: `0`)
  - Количество попыток повтора при таймауте запроса
  - Установите в `0` для немедленного переключения на следующий прокси при таймауте
  - Большие значения будут повторять тот же прокси перед переключением

#### Настройки таймаутов

- **`maxTimeout`** (число, по умолчанию: `5000`)
  - Максимальное время в миллисекундах ожидания завершения запроса
  - Применяется ко всем запросам через прокси
  - Запросы, превышающие этот таймаут, будут прерваны

#### Настройки проверки здоровья

- **`healthCheckUrl`** (строка, по умолчанию: `process.env.HEALTH_CHECK_URL` или `'https://httpbin.org/ip'`)
  - URL, используемый для тестирования доступности и задержки прокси
  - Должен быть надежным эндпоинтом, который быстро отвечает
  - Используется для автоматического мониторинга здоровья прокси

- **`healthCheckInterval`** (число, по умолчанию: `60000`)
  - Интервал в миллисекундах между автоматическими проверками здоровья
  - Установите в `0` для отключения автоматических проверок здоровья
  - Меньшие значения обеспечивают более актуальный статус прокси, но увеличивают нагрузку на сеть

#### Управление прокси

- **`changeProxyLoop`** (число циклов перед ошибкой, по умолчанию: `2`)
  - Количество циклов (кругов) перед тем как будет брошена ошибка.
  - Если установлено в `2`, все прокси пройдут по 2 раза
  - Влияет на общее количество попыток: `proxies.length × changeProxyLoop`

### Переменные окружения

Вы также можете настроить некоторые параметры через переменные окружения:

```bash
# файл .env
HEALTH_CHECK_URL=https://httpbin.org/ip
HEALTH_CHECK_INTERVAL=60000
TIMEOUT=5000
```

### Примеры конфигурации

#### Настройка высокой доступности
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    onErrorRetries: 2,           // Повторить неудачные запросы 2 раза
    onTimeoutRetries: 1,         // Повторить таймауты один раз
    maxTimeout: 10000,           // 10-секундный таймаут
    healthCheckInterval: 30000,  // Проверять прокси каждые 30 секунд
    changeProxyLoop: 3,          // Пробовать каждый прокси 3 раза
  }
});
```

#### Настройка быстрого переключения
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    onErrorRetries: 0,           // Без повторов, быстрое переключение
    onTimeoutRetries: 0,         // Без повторов таймаутов
    maxTimeout: 3000,            // Короткий таймаут
    healthCheckInterval: 15000,  // Частые проверки здоровья
    changeProxyLoop: 1,          // Одна попытка на прокси
  }
});
```

#### Настройка оптимизированной производительности
```typescript
const manager = new ProxyManager(proxies, {
  config: {
    maxTimeout: 5000,
    healthCheckInterval: 120000, // Менее частые проверки здоровья
    changeProxyLoop: 2,
  },
  disableLogging: true,          // Отключить логирование для лучшей производительности
});
```

## Тестирование

### Предварительные требования

**Обязательно** перед запуском тестов:

1. **Переменные окружения** - создайте файл `.env` в корне проекта:
```env
# Конфигурация окружения
NODE_ENV=development
TIMEOUT=5000
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_URL=https://httpbin.org/ip

CHAT_GPT_API_KEY="your_chat_gpt_api_key_here"
```

2. **Рабочий список прокси** - создайте файл `proxies-list.js` в корне проекта:
```javascript
module.exports = [
  { ip: '1.2.3.4', port: 1080, user: 'username', pass: 'password' },
  { ip: '5.6.7.8', port: 1080, user: 'username', pass: 'password' },
  // добавьте ваши рабочие прокси
];
```

### Запуск тестов

```bash
# Запуск ВСЕХ тестов (рекомендуемый способ)
npm test
```

Эта команда последовательно запустит все доступные тесты:
- ✅ Базовый тест прокси
- 🔍 Отладочный тест прокси
- 🔄 Тест переключения
- 🔐 Тест переключения с аутентификацией
- 💓 Проверка здоровья прокси
- 🌐 Тест API запросов
- ⚡ Быстрый интеграционный тест
- 📦 Тест пакета
- 🎵 Тест TTS ReadableStream

### Индивидуальный запуск тестов

Если нужно запустить конкретный тест:

```bash
# Тест базовой функциональности
node tests/proxy-basic-test.js

# Детальная отладка с расширенным логированием
node tests/proxy-debug-test.js

# Тест переключения
node tests/proxy-failover-test.js

# И другие тесты...
```

**Возможности тестов:**
- 🧹 Автоматическая очистка предыдущих логов
- 📊 Детальный отчет о результатах
- ⏱️ Измерение времени выполнения
- 📂 Логирование в папку `logs/`
- 🎨 Цветной вывод в консоль

Подробное описание каждого теста доступно в `tests/README.md`.

## Модульные тесты

Модульные тесты расположены рядом с тестируемыми модулями в папке src
