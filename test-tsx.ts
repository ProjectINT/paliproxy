#!/usr/bin/env -S tsx
// Простой тест запуска TypeScript через tsx
import configManager from './src/config.js';

console.log('🚀 Testing TypeScript execution with tsx...');
console.log('Node.js version:', process.version);
console.log('Current working directory:', process.cwd());

async function test() {
    try {
        console.log('📋 Loading configuration...');
        const config = configManager.get();
        console.log('✅ Configuration loaded successfully:', {
            logLevel: config.logLevel,
            healthCheckInterval: config.healthCheckInterval,
            httpTimeout: config.httpTimeout
        });
        
        console.log('🎉 TypeScript execution test completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

test();
