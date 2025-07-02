
# palivpn

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
npm install palivpn
```

2. Example usage:

```typescript
import { ProxyManager } from 'palivpn';

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

const response = await manager.request({
  url: 'https://api.ipify.org',
  method: 'GET',
  // ...
});
```

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

# palivpn (на русском)

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
npm install palivpn
```

2. Пример использования:

```typescript
import { ProxyManager } from 'palivpn';

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

## Тесты

- В папке `src/tests/` находятся примеры и автотесты для проверки работы ProxyManager и вспомогательных модулей.

## Лицензия

MIT
