# Logger

Sentry-совместимый логгер для записи логов в файл с поддержкой асинхронной записи и ротации логов.

## Возможности

- ✅ Полная совместимость с интерфейсом Sentry
- ✅ Асинхронная запись логов на диск
- ✅ Ротация логов (максимум 5MB на файл)
- ✅ Поддержка всех уровней логирования
- ✅ Breadcrumbs, теги, пользователи, контекст
- ✅ Автоматические тесты

## Использование

```typescript
import { logger, SeverityLevel } from './logger';

logger.setUser({ id: 'user123', username: 'john' });
logger.setTags({ environment: 'production' });
await logger.captureMessage('Hello World', SeverityLevel.Info);
await logger.captureException(new Error('Oops'));
```

## Тестирование

Запуск демо с автоматическими тестами:

```bash
npx ts-node src/utils/logger/demo-logger.ts
```

Логи сохраняются в `./logs/app.log`