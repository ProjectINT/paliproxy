# Конфигурация PaliVPN через Environment Variables

PaliVPN поддерживает настройку через переменные окружения с приоритетом:

1. **Переданный конфиг в конструкторе** (наивысший приоритет)
2. **Аргументы командной строки**
3. **Environment переменные**
4. **config.json файл**
5. **Значения по умолчанию** (наименьший приоритет)

## Environment Variables

### VPN настройки

- **`PALIVPN_CONFIG_PATH`** - путь к директории с VPN конфигурациями
  - По умолчанию: `./configs`
  - Пример: `export PALIVPN_CONFIG_PATH=/etc/openvpn/configs`

- **`PALIVPN_VPN_TIMEOUT`** - таймаут подключения к VPN (мс)
  - По умолчанию: `30000`
  - Пример: `export PALIVPN_VPN_TIMEOUT=45000`

- **`PALIVPN_MAX_RECONNECT_ATTEMPTS`** - максимальное количество попыток переподключения
  - По умолчанию: `3`
  - Пример: `export PALIVPN_MAX_RECONNECT_ATTEMPTS=5`

### Health Check настройки

- **`PALIVPN_HEALTH_CHECK_INTERVAL`** - интервал проверки здоровья VPN (мс)
  - По умолчанию: `60000`
  - Пример: `export PALIVPN_HEALTH_CHECK_INTERVAL=30000`

- **`PALIVPN_HEALTH_CHECK_URL`** - URL для проверки здоровья соединения
  - По умолчанию: `https://httpbin.org/ip`
  - Пример: `export PALIVPN_HEALTH_CHECK_URL=https://ifconfig.me/ip`

- **`PALIVPN_HEALTH_CHECK_TIMEOUT`** - таймаут для health check запросов (мс)
  - По умолчанию: `10000`
  - Пример: `export PALIVPN_HEALTH_CHECK_TIMEOUT=15000`

### HTTP настройки

- **`PALIVPN_HTTP_TIMEOUT`** - таймаут для HTTP запросов (мс)
  - По умолчанию: `10000`
  - Пример: `export PALIVPN_HTTP_TIMEOUT=20000`

- **`PALIVPN_USER_AGENT`** - User-Agent для HTTP запросов
  - По умолчанию: `PaliVPN/1.0.0`
  - Пример: `export PALIVPN_USER_AGENT="MyApp/2.0.0"`

### Logging настройки

- **`PALIVPN_LOG_LEVEL`** - уровень логирования
  - По умолчанию: `info`
  - Возможные значения: `debug`, `info`, `warn`, `error`
  - Пример: `export PALIVPN_LOG_LEVEL=debug`

### Общие настройки

- **`NODE_ENV`** - режим работы приложения
  - По умолчанию: `development`
  - Возможные значения: `development`, `production`, `test`
  - Пример: `export NODE_ENV=production`

## Аргументы командной строки

PaliVPN также поддерживает аргументы командной строки:

```bash
# Путь к VPN конфигурациям
node index.js --config-path /path/to/configs

# Уровень логирования
node index.js --log-level debug

# URL для health check
node index.js --health-check-url https://ifconfig.me/ip

# Таймауты
node index.js --http-timeout 20000 --vpn-timeout 45000
```

## Пример .env файла

```env
# VPN настройки
PALIVPN_CONFIG_PATH=/etc/openvpn/configs
PALIVPN_VPN_TIMEOUT=45000
PALIVPN_MAX_RECONNECT_ATTEMPTS=5

# Health Check
PALIVPN_HEALTH_CHECK_INTERVAL=30000
PALIVPN_HEALTH_CHECK_URL=https://ifconfig.me/ip
PALIVPN_HEALTH_CHECK_TIMEOUT=15000

# HTTP
PALIVPN_HTTP_TIMEOUT=20000
PALIVPN_USER_AGENT=MyApp/2.0.0

# Logging
PALIVPN_LOG_LEVEL=debug

# Environment
NODE_ENV=production
```

## Проверка конфигурации

Для проверки загруженной конфигурации используйте:

```typescript
import { configManager } from './src/config';

console.log('Current config:', configManager.get());
```
