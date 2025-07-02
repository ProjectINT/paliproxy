
# proxy-connection

Module for managing a proxy pool with automatic health-check, balancing, logging, and Dante support.

## Architecture

- **ProxyManager** — the main class for working with a proxy pool. Supports automatic health checks, latency-based balancing, retries, request stack, and attempt history.
- **Dante** — integration with [Dante Socks5 Proxy](https://www.inet.no/dante/) for automatic management and configuration of socks5 proxies via scripts and configs (see the `dante/` folder).
- **Logger** — logging module with Sentry support and an extensible interface (see `src/utils/logger`). All errors and events are passed through the logger.
- **SnowflakeId** — unique ID generation for requests (see `src/utils/snowflakeId`).
- **Proxy testing** — async availability and latency check for each proxy (see `src/utils/testProxy`).
- **Balancing** — selects the next proxy by minimal latency and retry policy (see `src/utils/getNextProxy`).

## Usage

1. Install the package:

```sh
npm install proxy-connection
```

2. Example usage with new fetch-like API:

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
  sentryLogger: myLoggerInstance, // optional
});

// New fetch-like API (recommended)
const response = await manager.request('https://api.ipify.org');
const ip = await response.text();

// With options (just like fetch)
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

### Fetch API Compatibility

ProxyManager now supports fetch-like API for easy migration from `fetch()`:

```typescript
// Before (standard fetch)
const response = await fetch(url, options);

// After (with ProxyManager)
const response = await manager.request(url, options);
```

The response object supports the same methods as fetch:
- `response.text()` - get response as text
- `response.json()` - parse response as JSON
- `response.ok` - boolean indicating success (status 200-299)
- `response.status` - HTTP status code
- `response.statusText` - HTTP status message

## Dante

- The `dante/` folder contains scripts and instructions for automatic socks5 proxy setup via Dante.
- Use `setup-dante.sh` for quick installation and configuration.
- Proxies in the pool can be both external and local via Dante.

## Logger

- By default, a built-in logger with Sentry support is used.
- You can provide your own logger implementing the `ISentryLogger` interface.
- All errors, attempts, and events are logged.

## Tests

- The `src/tests/` folder contains examples and tests for ProxyManager and helper modules.

## License

MIT

---

# proxy-connection (на русском)

Модуль для управления пулом прокси с автоматическим health-check, балансировкой, логированием и поддержкой Dante.

## Архитектура

- **ProxyManager** — основной класс для работы с пулом прокси. Поддерживает автоматическую проверку живости, балансировку по задержке, повторные попытки, ведёт стек запросов и историю попыток.
- **Dante** — интеграция с [Dante Socks5 Proxy](https://www.inet.no/dante/) для автоматического управления и настройки socks5-прокси через скрипты и конфиги (см. папку `dante/`).
- **Logger** — модуль логирования с поддержкой Sentry и расширяемым интерфейсом (см. `src/utils/logger`). Все ошибки и события прокидываются через логгер.
- **SnowflakeId** — генерация уникальных идентификаторов для запросов (см. `src/utils/snowflakeId`).
- **Тестирование прокси** — асинхронная проверка доступности и задержки для каждого прокси (см. `src/utils/testProxy`).
- **Балансировка** — выбор следующего прокси по минимальной задержке и политике повторов (см. `src/utils/getNextProxy`).

## Использование

1. Установите пакет:

```sh
npm install proxy-connection
```

2. Пример использования:

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
});

const response = await manager.request({
  url: 'https://api.ipify.org',
  method: 'GET',
  // ...
});
```

## Dante

- В папке `dante/` находятся скрипты и инструкции для автоматической настройки socks5-прокси через Dante.
- Используйте `setup-dante.sh` для быстрой установки и конфигурирования.
- Прокси, добавленные в пул, могут быть как внешними, так и локальными через Dante.

## Logger

- По умолчанию используется встроенный логгер с поддержкой Sentry.
- Можно передать свой логгер, реализующий интерфейс `ISentryLogger`.
- Все ошибки, попытки и события фиксируются через логгер.

## Тестирование

### Предварительные требования

**Обязательно** перед запуском тестов необходимо настроить:

1. **Переменные окружения** - создайте файл `.env` в корне проекта:
```env
# Environment Configuration
NODE_ENV=development
TIMEOUT=5000
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_URL=https://httpbin.org/ip

CHAT_GPT_API_KEY="your_chat_gpt_api_key_here"
```

2. **Список рабочих прокси** - создайте файл `proxies-list.js` в корне проекта:
```javascript
module.exports = [
  { ip: '1.2.3.4', port: 1080, user: 'username', pass: 'password' },
  { ip: '5.6.7.8', port: 1080, user: 'username', pass: 'password' },
  // добавьте ваши рабочие прокси
];
```

### Запуск тестов

```bash
# Запустить ВСЕ тесты (рекомендуемый способ)
npm test
```

Эта команда последовательно запустит все доступные тесты:
- ✅ Базовый тест прокси
- 🔍 Отладочный тест прокси  
- 🔄 Тест отказоустойчивости
- 🔐 Тест отказоустойчивости с аутентификацией
- 💓 Проверка здоровья прокси
- 🌐 Тест API запросов
- ⚡ Быстрый интеграционный тест
- 📦 Тест пакета
- 🎵 Тест TTS ReadableStream

### Индивидуальный запуск тестов

Если необходимо запустить конкретный тест:

```bash
# Основной тест функциональности
node tests/proxy-basic-test.js

# Детальная отладка с расширенным логированием  
node tests/proxy-debug-test.js

# Тест отказоустойчивости
node tests/proxy-failover-test.js

# И другие тесты...
```

**Особенности тестов:**
- 🧹 Автоматическая очистка предыдущих логов
- 📊 Подробный отчет о результатах
- ⏱️ Измерение времени выполнения
- 📂 Логирование в папку `logs/`
- 🎨 Цветной вывод в консоли

Подробное описание каждого теста находится в `tests/README.md`.

## Модульные тесты

В папке `src/tests/` находятся юнит-тесты для отдельных модулей и компонентов.

## Лицензия

MIT
