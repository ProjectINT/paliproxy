# Snowflake ID Generator

Flexible generator of unique 64-bit identifiers based on Twitter's Snowflake algorithm with customizable bit distribution and automatic machineId detection.

## ID Format

```
[timestamp:X bits][machineId:Y bits][sequence:Z bits] where X+Y+Z=64
```

- **Timestamp**: milliseconds since epoch (customizable)
- **Machine ID**: unique machine ID (1-22 bits, determined automatically by MAC/hostname or set explicitly)
- **Sequence**: counter per millisecond (1-22 bits)

## Usage

```typescript
import { generateSnowflakeId, createSnowflakeGenerator, createCustomSnowflakeGenerator, SnowflakeConfigs } from './index';

// Standard generator (42-10-12), machineId determined automatically
const id = generateSnowflakeId();

// Custom configuration with auto machineId
const generator = createSnowflakeGenerator('auto', {
  machineIdBits: 8,  // 256 machines
  sequenceBits: 15,  // 32K ID/ms
  epoch: 1640995200000
});

// Explicit machineId setting
const generatorManual = createSnowflakeGenerator(5, { machineIdBits: 8, sequenceBits: 15 });

// Preset configurations (machineId determined automatically)
const highFreq = createCustomSnowflakeGenerator(SnowflakeConfigs.HIGH_FREQUENCY);
const manyMachines = createCustomSnowflakeGenerator(SnowflakeConfigs.MANY_MACHINES);
```

## Automatic machineId Detection

- By default, machineId is calculated based on MAC address of the first non-loopback interface.
- If MAC is unavailable — based on hostname.
- If hostname is also unavailable — random value.
- You can explicitly set machineId (e.g., for Docker clusters or tests).

**Production best practices:**
- In Docker/cluster environments, it's recommended to explicitly set machineId via environment variables or config.
- To avoid collisions, ensure machineId is unique within the cluster.

## Presets

- **STANDARD**: 42-10-12 (Twitter compatible)
- **HIGH_FREQUENCY**: 41-8-15 (up to 32K ID/ms)
- **MANY_MACHINES**: 40-14-10 (up to 16K machines)
- **MINIMAL_MACHINES**: 44-6-14 (64 machines, long timestamp)

## Tests

```bash
npx tsx src/utils/snowflakeId/runTests.ts
```
