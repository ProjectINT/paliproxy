import os from 'os';
import crypto from 'crypto';

/**
 * Snowflake ID Generator
 *
 * Generates unique 64-bit IDs based on timestamp, machine ID, and sequence number
 * Format: [timestamp:Xbits][machineId:Ybits][sequence:Zbits] where X+Y+Z = 64
 */

// Default configuration (Twitter Snowflake compatible)
const DEFAULT_EPOCH = 1420070400000; // Custom epoch (January 1, 2015 UTC)
const DEFAULT_MACHINE_ID_BITS = 10;
const DEFAULT_SEQUENCE_BITS = 12;

interface SnowflakeConfig {
  epoch?: number;
  machineIdBits?: number;
  sequenceBits?: number;
}

class SnowflakeGenerator {
  private machineId: number;
  private sequence: number = 0;
  private lastTimestamp: number = 0;

  // Configuration
  private readonly epoch: number;
  private readonly machineIdBits: number;
  private readonly sequenceBits: number;
  private readonly timestampBits: number;

  // Calculated limits and shifts
  private readonly maxMachineId: number;
  private readonly maxSequence: number;
  private readonly machineIdShift: number;
  private readonly timestampShift: number;

  constructor(machineId?: number | 'auto', config: SnowflakeConfig = {}) {
    // Set configuration with defaults
    this.epoch = config.epoch ?? DEFAULT_EPOCH;
    this.machineIdBits = config.machineIdBits ?? DEFAULT_MACHINE_ID_BITS;
    this.sequenceBits = config.sequenceBits ?? DEFAULT_SEQUENCE_BITS;
    this.timestampBits = 64 - this.machineIdBits - this.sequenceBits;

    // Validate configuration
    if (this.timestampBits <= 0) {
      throw new Error('Invalid configuration: timestamp bits must be positive');
    }
    if (this.machineIdBits <= 0 || this.sequenceBits <= 0) {
      throw new Error('Invalid configuration: machine ID and sequence bits must be positive');
    }
    if (this.timestampBits + this.machineIdBits + this.sequenceBits !== 64) {
      throw new Error('Invalid configuration: total bits must equal 64');
    }

    // Calculate limits and shifts
    this.maxMachineId = (1 << this.machineIdBits) - 1;
    this.maxSequence = (1 << this.sequenceBits) - 1;
    this.machineIdShift = this.sequenceBits;
    this.timestampShift = this.sequenceBits + this.machineIdBits;

    // Determine machineId automatically if not passed explicitly or passed as 'auto'
    let resolvedMachineId: number;
    if (machineId === undefined || machineId === 'auto') {
      resolvedMachineId = getAutoMachineId(this.maxMachineId);
    } else {
      resolvedMachineId = machineId;
    }
    // Validate machine ID
    if (resolvedMachineId < 0 || resolvedMachineId > this.maxMachineId) {
      throw new Error(`Machine ID must be between 0 and ${this.maxMachineId}`);
    }
    this.machineId = resolvedMachineId;
  }

  /**
   * Generate a new Snowflake ID
   * @returns {string} 64-bit ID as string
   */
  generate(): string {
    let timestamp = Date.now();

    // Handle clock moving backwards
    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Cannot generate ID');
    }

    // If same millisecond, increment sequence
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & this.maxSequence;

      // If sequence overflows, wait for next millisecond
      if (this.sequence === 0) {
        timestamp = this.waitNextMillis(timestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    // Generate the ID using BigInt to avoid overflow
    const timestampPart = BigInt(timestamp - this.epoch) << BigInt(this.timestampShift);
    const machineIdPart = BigInt(this.machineId) << BigInt(this.machineIdShift);
    const sequencePart = BigInt(this.sequence);

    const id = timestampPart | machineIdPart | sequencePart;

    return id.toString();
  }

  /**
   * Generate multiple IDs
   * @param count Number of IDs to generate
   * @returns Array of Snowflake IDs
   */
  generateBatch(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate());
    }
    return ids;
  }

  /**
   * Wait for next millisecond
   * @param lastTimestamp Previous timestamp
   * @returns New timestamp
   */
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  /**
   * Parse Snowflake ID to extract components
   * @param id Snowflake ID string
   * @returns Object with timestamp, machineId, and sequence
   */
  static parse(id: string, config: SnowflakeConfig = {}): { timestamp: number; machineId: number; sequence: number; date: Date } {
    // Use provided config or defaults
    const epoch = config.epoch ?? DEFAULT_EPOCH;
    const machineIdBits = config.machineIdBits ?? DEFAULT_MACHINE_ID_BITS;
    const sequenceBits = config.sequenceBits ?? DEFAULT_SEQUENCE_BITS;

    // Calculate shifts and masks
    const maxMachineId = (1 << machineIdBits) - 1;
    const maxSequence = (1 << sequenceBits) - 1;
    const machineIdShift = sequenceBits;
    const timestampShift = sequenceBits + machineIdBits;

    const idNum = BigInt(id);

    const timestamp = Number((idNum >> BigInt(timestampShift)) + BigInt(epoch));
    const machineId = Number((idNum >> BigInt(machineIdShift)) & BigInt(maxMachineId));
    const sequence = Number(idNum & BigInt(maxSequence));

    return {
      timestamp,
      machineId,
      sequence,
      date: new Date(timestamp)
    };
  }

  /**
   * Parse Snowflake ID using this generator's configuration
   * @param id Snowflake ID string
   * @returns Object with timestamp, machineId, and sequence
   */
  parse(id: string): { timestamp: number; machineId: number; sequence: number; date: Date } {
    const idNum = BigInt(id);

    const timestamp = Number((idNum >> BigInt(this.timestampShift)) + BigInt(this.epoch));
    const machineId = Number((idNum >> BigInt(this.machineIdShift)) & BigInt(this.maxMachineId));
    const sequence = Number(idNum & BigInt(this.maxSequence));

    return {
      timestamp,
      machineId,
      sequence,
      date: new Date(timestamp)
    };
  }

  /**
   * Get generator configuration
   */
  getConfig(): Required<SnowflakeConfig> & { timestampBits: number; maxMachineId: number; maxSequence: number } {
    return {
      epoch: this.epoch,
      machineIdBits: this.machineIdBits,
      sequenceBits: this.sequenceBits,
      timestampBits: this.timestampBits,
      maxMachineId: this.maxMachineId,
      maxSequence: this.maxSequence
    };
  }
}

// Default instance (auto machineId)
const defaultGenerator = new SnowflakeGenerator('auto');

/**
 * Generate a Snowflake ID using default generator
 * @returns Snowflake ID string
 */
export function generateSnowflakeId(): string {
  return defaultGenerator.generate();
}

/**
 * Generate multiple Snowflake IDs
 * @param count Number of IDs to generate
 * @returns Array of Snowflake IDs
 */
export function generateSnowflakeIds(count: number): string[] {
  return defaultGenerator.generateBatch(count);
}

/**
 * Create a new Snowflake generator with custom machine ID and configuration
 * @param machineId Machine ID (0 to maxMachineId based on config)
 * @param config Optional configuration for bit allocation
 * @returns SnowflakeGenerator instance
 */
export function createSnowflakeGenerator(machineId?: number | 'auto', config?: SnowflakeConfig): SnowflakeGenerator {
  return new SnowflakeGenerator(machineId, config);
}

export function createCustomSnowflakeGenerator(config: SnowflakeConfig, machineId?: number | 'auto'): SnowflakeGenerator {
  return new SnowflakeGenerator(machineId ?? 'auto', config);
}

/**
 * Parse Snowflake ID to extract components using default configuration
 * @param id Snowflake ID string
 * @param config Optional configuration (should match the generator's config)
 * @returns Object with timestamp, machineId, sequence, and date
 */
export function parseSnowflakeId(id: string, config?: SnowflakeConfig): { timestamp: number; machineId: number; sequence: number; date: Date } {
  return SnowflakeGenerator.parse(id, config);
}

/**
 * Try to get a unique machine ID based on MAC address, hostname, or fallback to random.
 * @param maxMachineId Maximum allowed machineId (by bit width)
 */
function getAutoMachineId(maxMachineId: number): number {
  // 1. MAC address (first non-loopback)
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        const macHash = crypto.createHash('md5').update(net.mac).digest();
        const macByte = macHash?.[0];
        if (typeof macByte === 'number') {
          return macByte % (maxMachineId + 1);
        }
      }
    }
  }
  // 2. Hostname
  try {
    const hostname = os.hostname();
    const hostHash = crypto.createHash('md5').update(hostname).digest();
    const hostByte = hostHash?.[0];
    if (typeof hostByte === 'number') {
      return hostByte % (maxMachineId + 1);
    }
  } catch {
    // ignore
  }
  // 3. Fallback: random
  return Math.floor(Math.random() * (maxMachineId + 1));
}

// Predefined configurations for common use cases
export const SnowflakeConfigs = {
  /** Standard Twitter Snowflake: 42-bit timestamp, 10-bit machine, 12-bit sequence */
  STANDARD: {
    epoch: DEFAULT_EPOCH,
    machineIdBits: 10,
    sequenceBits: 12
  },

  /** High frequency: 41-bit timestamp, 8-bit machine, 15-bit sequence (32K/ms per machine) */
  HIGH_FREQUENCY: {
    epoch: DEFAULT_EPOCH,
    machineIdBits: 8,
    sequenceBits: 15
  },

  /** Many machines: 40-bit timestamp, 14-bit machine, 10-bit sequence (16K machines, 1K/ms each) */
  MANY_MACHINES: {
    epoch: DEFAULT_EPOCH,
    machineIdBits: 14,
    sequenceBits: 10
  },

  /** Minimal machines: 44-bit timestamp, 6-bit machine, 14-bit sequence (64 machines, 16K/ms each) */
  MINIMAL_MACHINES: {
    epoch: DEFAULT_EPOCH,
    machineIdBits: 6,
    sequenceBits: 14
  }
};

export { SnowflakeGenerator, type SnowflakeConfig, getAutoMachineId };
