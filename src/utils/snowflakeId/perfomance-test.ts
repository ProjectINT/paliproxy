import { generateSnowflakeId } from './index';
import os from 'os';
import fs from 'fs';
import path from 'path';

const COUNT = 1_000_000;
const ids = new Set<string>();
const start = Date.now();

for (let i = 0; i < COUNT; i++) {
  ids.add(generateSnowflakeId());
}

const duration = Date.now() - start;
const unique = ids.size;
const rate = Math.round(COUNT / (duration / 1000));

const machineInfo = {
  platform: os.platform(),
  arch: os.arch(),
  cpus: os.cpus().map(cpu => cpu.model),
  totalmem: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
  hostname: os.hostname(),
  node: process.version
};

const log = [
  'Snowflake Performance Test',
  `Date: ${new Date().toISOString()}`,
  `Machine: ${machineInfo.hostname}`,
  `Platform: ${machineInfo.platform} ${machineInfo.arch}`,
  `CPU: ${machineInfo.cpus[0]} (${machineInfo.cpus.length} cores)`,
  `RAM: ${machineInfo.totalmem}`,
  `Node.js: ${machineInfo.node}`,
  `IDs generated: ${COUNT}`,
  `Unique IDs: ${unique}`,
  `Duration: ${duration} ms`,
  `Rate: ${rate} IDs/sec`,
  unique === COUNT ? 'No collisions detected.' : 'COLLISIONS DETECTED!'
].join('\n');

const logPath = path.join(__dirname, 'perfomance-result.log');
fs.writeFileSync(logPath, log + '\n');

console.log('Performance test complete. See perfomance-result.log for summary.');
