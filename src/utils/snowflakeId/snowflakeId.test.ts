import {
  generateSnowflakeId,
  generateSnowflakeIds,
  createSnowflakeGenerator,
  parseSnowflakeId,
  SnowflakeGenerator,
  SnowflakeConfigs,
  createCustomSnowflakeGenerator
} from './index';

/**
 * Simple test runner
 */
class TestRunner {
  private testsPassed = 0;
  private testsFailed = 0;

  test(name: string, testFn: () => void | Promise<void>): void {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      const result = testFn();

      if (result instanceof Promise) {
        result
          .then(() => {
            console.log(`✅ PASSED: ${name}`);
            this.testsPassed++;
          })
          .catch((error) => {
            console.log(`❌ FAILED: ${name}`);
            console.error(error);
            this.testsFailed++;
          });
      } else {
        console.log(`✅ PASSED: ${name}`);
        this.testsPassed++;
      }
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.error(error);
      this.testsFailed++;
    }
  }

  expect(actual: any): any {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },
      toBeInstanceOf: (expectedClass: any) => {
        if (!(actual instanceof expectedClass)) {
          throw new Error(`Expected instance of ${expectedClass.name}, but got ${typeof actual}`);
        }
      },
      toMatch: (pattern: RegExp) => {
        if (!pattern.test(actual)) {
          throw new Error(`Expected ${actual} to match pattern ${pattern}`);
        }
      },
      toThrow: (expectedError?: string) => {
        try {
          actual();
          throw new Error('Expected function to throw an error');
        } catch (error: any) {
          if (expectedError && !error.message.includes(expectedError)) {
            throw new Error(`Expected error to contain "${expectedError}", but got "${error.message}"`);
          }
        }
      }
    };
  }

  summary(): void {
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${this.testsPassed}`);
    console.log(`❌ Failed: ${this.testsFailed}`);
    console.log(`📈 Total: ${this.testsPassed + this.testsFailed}`);

    if (this.testsFailed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`💥 ${this.testsFailed} test(s) failed!`);
    }
  }
}

// Test runner instance
const test = new TestRunner();

// Helper function to assert between values
function assertBetween(value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`Expected ${value} to be between ${min} and ${max}`);
  }
}

// Tests for generateSnowflakeId
test.test('generateSnowflakeId generates a valid ID', () => {
  const id = generateSnowflakeId();

  test.expect(typeof id).toBe('string');
  test.expect(id.length).toBeGreaterThan(0);
  test.expect(id).toMatch(/^\d+$/); // Should be numeric string
});

test.test('generateSnowflakeId generates unique IDs', () => {
  const id1 = generateSnowflakeId();
  const id2 = generateSnowflakeId();

  test.expect(id1 !== id2).toBe(true);
});

test.test('generateSnowflakeId generates sequential IDs', () => {
  const id1 = BigInt(generateSnowflakeId());
  const id2 = BigInt(generateSnowflakeId());

  test.expect(id2 > id1).toBe(true);
});

// Tests for generateSnowflakeIds
test.test('generateSnowflakeIds generates correct number of IDs', () => {
  const count = 5;
  const ids = generateSnowflakeIds(count);

  test.expect(ids.length).toBe(count);
  test.expect(Array.isArray(ids)).toBe(true);
});

test.test('generateSnowflakeIds generates unique IDs in batch', () => {
  const ids = generateSnowflakeIds(10);
  const uniqueIds = new Set(ids);

  test.expect(uniqueIds.size).toBe(ids.length);
});

test.test('generateSnowflakeIds handles empty batch', () => {
  const ids = generateSnowflakeIds(0);

  test.expect(ids.length).toBe(0);
  test.expect(Array.isArray(ids)).toBe(true);
});

// Tests for createSnowflakeGenerator
test.test('createSnowflakeGenerator creates generator with custom machine ID', () => {
  const machineId = 42;
  const generator = createSnowflakeGenerator(machineId);

  test.expect(generator).toBeInstanceOf(SnowflakeGenerator);

  const id = generator.generate();
  const parsed = parseSnowflakeId(id);

  test.expect(parsed.machineId).toBe(machineId);
});

test.test('createSnowflakeGenerator throws error for invalid machine ID', () => {
  test.expect(() => createSnowflakeGenerator(-1)).toThrow('Machine ID must be between 0 and 1023');
  test.expect(() => createSnowflakeGenerator(1024)).toThrow('Machine ID must be between 0 and 1023');
});

test.test('createSnowflakeGenerator accepts valid machine ID range', () => {
  const generator1 = createSnowflakeGenerator(0);
  const generator2 = createSnowflakeGenerator(1023);

  test.expect(generator1).toBeInstanceOf(SnowflakeGenerator);
  test.expect(generator2).toBeInstanceOf(SnowflakeGenerator);
});

// Tests for parseSnowflakeId
test.test('parseSnowflakeId correctly parses generated ID', () => {
  const generator = createSnowflakeGenerator(123);
  const id = generator.generate();
  const parsed = parseSnowflakeId(id);

  test.expect(typeof parsed.timestamp).toBe('number');
  test.expect(typeof parsed.machineId).toBe('number');
  test.expect(typeof parsed.sequence).toBe('number');
  test.expect(parsed.date).toBeInstanceOf(Date);

  test.expect(parsed.machineId).toBe(123);
  assertBetween(parsed.sequence, 0, 4095);
  assertBetween(parsed.machineId, 0, 1023);
});

test.test('parseSnowflakeId timestamp is reasonable', () => {
  const beforeGeneration = Date.now();
  const id = generateSnowflakeId();
  const afterGeneration = Date.now();
  const parsed = parseSnowflakeId(id);

  // Timestamp should be between generation time
  assertBetween(parsed.timestamp, beforeGeneration, afterGeneration + 1000);

  // Date should match timestamp
  test.expect(parsed.date.getTime()).toBe(parsed.timestamp);
});

// Tests for SnowflakeGenerator class
test.test('SnowflakeGenerator default constructor works', () => {
  const generator = new SnowflakeGenerator();
  const id = generator.generate();
  const parsed = parseSnowflakeId(id);
  // machineId теперь определяется автоматически, проверяем диапазон
  test.expect(typeof parsed.machineId).toBe('number');
  test.expect(parsed.machineId).toBeGreaterThan(-1);
  test.expect(parsed.machineId).toBeLessThan(1024);
});

test.test('SnowflakeGenerator generates sequential IDs', () => {
  const generator = new SnowflakeGenerator(5);
  const id1 = BigInt(generator.generate());
  const id2 = BigInt(generator.generate());

  test.expect(id2 > id1).toBe(true);
});

test.test('SnowflakeGenerator generateBatch works correctly', () => {
  const generator = new SnowflakeGenerator(10);
  const ids = generator.generateBatch(3);

  test.expect(ids.length).toBe(3);

  // All should have same machine ID
  ids.forEach(id => {
    const parsed = parseSnowflakeId(id);
    test.expect(parsed.machineId).toBe(10);
  });

  // All should be unique
  const uniqueIds = new Set(ids);
  test.expect(uniqueIds.size).toBe(3);
});

test.test('SnowflakeGenerator handles high frequency generation', () => {
  const generator = new SnowflakeGenerator(99);
  const ids: string[] = [];

  // Generate many IDs quickly
  for (let i = 0; i < 100; i++) {
    ids.push(generator.generate());
  }

  // All should be unique
  const uniqueIds = new Set(ids);
  test.expect(uniqueIds.size).toBe(100);

  // All should have correct machine ID
  ids.forEach(id => {
    const parsed = parseSnowflakeId(id);
    test.expect(parsed.machineId).toBe(99);
  });
});

test.test('SnowflakeGenerator parse static method works', () => {
  const generator = new SnowflakeGenerator(456);
  const id = generator.generate();
  const parsed = SnowflakeGenerator.parse(id);

  test.expect(parsed.machineId).toBe(456);
  test.expect(typeof parsed.timestamp).toBe('number');
  test.expect(typeof parsed.sequence).toBe('number');
  test.expect(parsed.date).toBeInstanceOf(Date);
});

// Performance test
test.test('SnowflakeGenerator performance test', () => {
  const generator = new SnowflakeGenerator(777);
  const startTime = Date.now();
  const testCount = 1000;

  const ids = generator.generateBatch(testCount);
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`Generated ${testCount} IDs in ${duration}ms`);
  console.log(`Rate: ${Math.round(testCount / (duration / 1000))} IDs/second`);

  test.expect(ids.length).toBe(testCount);
  test.expect(duration).toBeLessThan(1000); // Should take less than 1 second
});

// Edge cases
test.test('SnowflakeGenerator handles boundary machine IDs', () => {
  const generator0 = new SnowflakeGenerator(0);
  const generator1023 = new SnowflakeGenerator(1023);

  const id0 = generator0.generate();
  const id1023 = generator1023.generate();

  const parsed0 = parseSnowflakeId(id0);
  const parsed1023 = parseSnowflakeId(id1023);

  test.expect(parsed0.machineId).toBe(0);
  test.expect(parsed1023.machineId).toBe(1023);
});

// Tests for configurable parameters
test.test('SnowflakeGenerator accepts custom configuration', () => {
  const config = {
    machineIdBits: 8,
    sequenceBits: 15,
    epoch: 1640995200000 // 2022-01-01
  };

  const generator = new SnowflakeGenerator(50, config);
  const generatorConfig = generator.getConfig();

  test.expect(generatorConfig.machineIdBits).toBe(8);
  test.expect(generatorConfig.sequenceBits).toBe(15);
  test.expect(generatorConfig.timestampBits).toBe(41); // 64 - 8 - 15
  test.expect(generatorConfig.maxMachineId).toBe(255); // 2^8 - 1
  test.expect(generatorConfig.maxSequence).toBe(32767); // 2^15 - 1
});

test.test('SnowflakeGenerator validates machine ID based on config', () => {
  const config = { machineIdBits: 6, sequenceBits: 16 }; // max machine ID = 63

  test.expect(() => new SnowflakeGenerator(64, config)).toThrow('Machine ID must be between 0 and 63');

  // Test valid machine ID doesn't throw
  try {
    new SnowflakeGenerator(63, config);
    // If we get here, no error was thrown - this is expected
  } catch {
    throw new Error('Expected constructor not to throw for valid machine ID');
  }
});

test.test('SnowflakeGenerator validates bit allocation', () => {
  test.expect(() => new SnowflakeGenerator(1, { machineIdBits: 32, sequenceBits: 33 }))
    .toThrow('Invalid configuration: timestamp bits must be positive');

  test.expect(() => new SnowflakeGenerator(1, { machineIdBits: 0, sequenceBits: 12 }))
    .toThrow('Invalid configuration: machine ID and sequence bits must be positive');
});

test.test('createCustomSnowflakeGenerator works with predefined configs', () => {
  const highFreqGen = createCustomSnowflakeGenerator(SnowflakeConfigs.HIGH_FREQUENCY);
  const config = highFreqGen.getConfig();

  test.expect(config.machineIdBits).toBe(8);
  test.expect(config.sequenceBits).toBe(15);
  test.expect(config.maxSequence).toBe(32767);
});

test.test('parseSnowflakeId works with custom config', () => {
  const config = { machineIdBits: 8, sequenceBits: 14 };
  const generator = new SnowflakeGenerator(100, config);

  const id = generator.generate();
  const parsed = parseSnowflakeId(id, config);

  test.expect(parsed.machineId).toBe(100);
});

test.test('High frequency configuration allows more IDs per millisecond', () => {
  const highFreqGen = createCustomSnowflakeGenerator(SnowflakeConfigs.HIGH_FREQUENCY);
  const config = highFreqGen.getConfig();

  // Should allow 32K IDs per millisecond (15 bits)
  test.expect(config.maxSequence).toBe(32767);
  test.expect(config.maxMachineId).toBe(255); // 8 bits
});

test.test('Many machines configuration allows more machines', () => {
  const manyMachinesGen = createCustomSnowflakeGenerator(SnowflakeConfigs.MANY_MACHINES);
  const config = manyMachinesGen.getConfig();

  // Should allow 16K machines (14 bits)
  test.expect(config.maxMachineId).toBe(16383);
  test.expect(config.maxSequence).toBe(1023); // 10 bits
});

// Integration test
test.test('Full integration test', () => {
  // Create multiple generators
  const gen1 = createSnowflakeGenerator(100);
  const gen2 = createSnowflakeGenerator(200);

  // Generate IDs from both
  const ids1 = gen1.generateBatch(5);
  const ids2 = gen2.generateBatch(5);

  // All IDs should be unique across generators
  const allIds = [...ids1, ...ids2];
  const uniqueIds = new Set(allIds);
  test.expect(uniqueIds.size).toBe(10);

  // Parse and verify machine IDs
  ids1.forEach(id => {
    const parsed = parseSnowflakeId(id);
    test.expect(parsed.machineId).toBe(100);
  });

  ids2.forEach(id => {
    const parsed = parseSnowflakeId(id);
    test.expect(parsed.machineId).toBe(200);
  });

  // Также тестируем default generator (auto machineId)
  const defaultId = generateSnowflakeId();
  const defaultParsed = parseSnowflakeId(defaultId);
  test.expect(typeof defaultParsed.machineId).toBe('number');
  test.expect(defaultParsed.machineId).toBeGreaterThan(-1);
  test.expect(defaultParsed.machineId).toBeLessThan(1024);
});

// Tests for auto-detection of machineId
test.test('Auto machineId: MAC/hostname/fallback returns valid range', () => {
  const { getAutoMachineId } = require('./index');
  // Проверяем для разных битностей
  [6, 8, 10, 14].forEach(bits => {
    const max = (1 << bits) - 1;
    const id = getAutoMachineId(max);
    test.expect(typeof id).toBe('number');
    test.expect(id).toBeGreaterThan(-1);
    test.expect(id).toBeLessThan(max + 1);
  });
});

test.test('SnowflakeGenerator auto machineId works and is in valid range', () => {
  const gen = new SnowflakeGenerator('auto', { machineIdBits: 8, sequenceBits: 12 });
  const config = gen.getConfig();
  test.expect(gen['machineId']).toBeGreaterThan(-1);
  test.expect(gen['machineId']).toBeLessThan(config.maxMachineId + 1);
});

test.test('createSnowflakeGenerator with auto machineId', () => {
  const gen = createSnowflakeGenerator('auto', { machineIdBits: 6, sequenceBits: 14 });
  const config = gen.getConfig();
  test.expect(gen['machineId']).toBeGreaterThan(-1);
  test.expect(gen['machineId']).toBeLessThan(config.maxMachineId + 1);
});

test.test('createCustomSnowflakeGenerator with auto machineId', () => {
  const gen = createCustomSnowflakeGenerator(SnowflakeConfigs.MINIMAL_MACHINES);
  const config = gen.getConfig();
  test.expect(gen['machineId']).toBeGreaterThan(-1);
  test.expect(gen['machineId']).toBeLessThan(config.maxMachineId + 1);
});

// Run all tests and show summary
console.log('🚀 Running Snowflake ID Generator Tests...');
console.log('=' .repeat(50));

// Small delay to let all tests complete
setTimeout(() => {
  test.summary();
}, 100);
