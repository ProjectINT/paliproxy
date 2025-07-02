# Logger

Sentry-compatible logger for writing logs to file with asynchronous writing and log rotation support.

## Features

- ✅ Full compatibility with Sentry interface
- ✅ Asynchronous log writing to disk
- ✅ Log rotation (maximum 5MB per file)
- ✅ Support for all logging levels
- ✅ Breadcrumbs, tags, users, context
- ✅ Automated tests

## Usage

```typescript
import { logger, SeverityLevel } from './logger';

logger.setUser({ id: 'user123', username: 'john' });
logger.setTags({ environment: 'production' });
await logger.captureMessage('Hello World', SeverityLevel.Info);
await logger.captureException(new Error('Oops'));
```

## Testing

Run demo with automated tests:

```bash
npx ts-node src/utils/logger/demo-logger.ts
```

Logs are saved to `./logs/app.log`