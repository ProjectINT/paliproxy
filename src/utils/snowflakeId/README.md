# Snowflake ID Generator

Гибкий генератор уникальных 64-битных идентификаторов на основе алгоритма Twitter Snowflake с настраиваемым распределением битов и автоматическим определением machineId.

## Формат ID

```
[timestamp:X bits][machineId:Y bits][sequence:Z bits] где X+Y+Z=64
```

- **Timestamp**: миллисекунды с эпохи (настраиваемая)
- **Machine ID**: уникальный ID машины (1-22 бит, определяется автоматически по MAC/hostname или задается явно)
- **Sequence**: счетчик в миллисекунду (1-22 бит)

## Использование

```typescript
import { generateSnowflakeId, createSnowflakeGenerator, createCustomSnowflakeGenerator, SnowflakeConfigs } from './index';

// Стандартный генератор (42-10-12), machineId определяется автоматически
const id = generateSnowflakeId();

// Кастомная конфигурация с авто machineId
const generator = createSnowflakeGenerator('auto', {
  machineIdBits: 8,  // 256 машин
  sequenceBits: 15,  // 32K ID/мс
  epoch: 1640995200000
});

// Явное задание machineId
const generatorManual = createSnowflakeGenerator(5, { machineIdBits: 8, sequenceBits: 15 });

// Предустановленные конфигурации (machineId определяется автоматически)
const highFreq = createCustomSnowflakeGenerator(SnowflakeConfigs.HIGH_FREQUENCY);
const manyMachines = createCustomSnowflakeGenerator(SnowflakeConfigs.MANY_MACHINES);
```

## Автоматическое определение machineId

- По умолчанию machineId вычисляется на основе MAC-адреса первого не-loopback интерфейса.
- Если MAC недоступен — по hostname.
- Если и hostname недоступен — случайное значение.
- Можно явно задать machineId (например, для Docker-кластера или тестов).

**Best practices для production:**
- В Docker/кластерных средах рекомендуется явно задавать machineId через переменные окружения или конфиг.
- Для избежания коллизий убедитесь, что machineId уникален в рамках кластера.

## Предустановки

- **STANDARD**: 42-10-12 (Twitter совместимый)
- **HIGH_FREQUENCY**: 41-8-15 (до 32K ID/мс)
- **MANY_MACHINES**: 40-14-10 (до 16K машин)
- **MINIMAL_MACHINES**: 44-6-14 (64 машины, долгий timestamp)

## Тесты

```bash
npx tsx src/utils/snowflakeId/runTests.ts
```
