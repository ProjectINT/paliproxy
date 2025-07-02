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

## Тесты

- В папке `src/tests/` находятся примеры и автотесты для проверки работы ProxyManager и вспомогательных модулей.

## Лицензия

MIT
