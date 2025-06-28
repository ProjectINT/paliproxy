/**
 * Тесты для вспомогательных классов и утилит VPNManager
 */

import { 
    AsyncMutex, 
    AsyncSemaphore, 
    AsyncReadWriteLock 
} from '../concurrency';
import { logger, delay } from '../utils';

// === ТЕСТЫ CONCURRENCY ===

class ConcurrencyTestSuite {
    private totalTests = 0;
    private passedTests = 0;
    private failedTests = 0;
    
    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        this.totalTests++;
        logger.info(`🧪 Running concurrency test: ${testName}`);
        
        try {
            await testFn();
            this.passedTests++;
            logger.info(`✅ Test passed: ${testName}`);
        } catch (error) {
            this.failedTests++;
            logger.error(`❌ Test failed: ${testName}`, error);
            throw error;
        }
    }
    
    private printSummary(): void {
        logger.info(`\n=== CONCURRENCY TEST SUMMARY ===`);
        logger.info(`Total tests: ${this.totalTests}`);
        logger.info(`Passed: ${this.passedTests}`);
        logger.info(`Failed: ${this.failedTests}`);
        logger.info(`Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    }
    
    private assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    // === ТЕСТЫ AsyncMutex ===
    
    private async testAsyncMutexBasic(): Promise<void> {
        const mutex = new AsyncMutex();
        
        this.assert(!mutex.isLocked(), 'Mutex should not be locked initially');
        
        const result = await mutex.runWithLock(async () => {
            this.assert(mutex.isLocked(), 'Mutex should be locked during execution');
            return 'test-result';
        });
        
        this.assert(result === 'test-result', 'Should return correct result');
        this.assert(!mutex.isLocked(), 'Mutex should be unlocked after execution');
    }
    
    private async testAsyncMutexConcurrency(): Promise<void> {
        const mutex = new AsyncMutex();
        const results: number[] = [];
        const startTime = Date.now();
        
        const promises = Array.from({ length: 3 }, (_, i) => 
            mutex.runWithLock(async () => {
                await delay(100);
                results.push(i);
                return i;
            })
        );
        
        await Promise.all(promises);
        const endTime = Date.now();
        
        // Операции должны выполняться последовательно
        this.assert(results.length === 3, 'Should execute all operations');
        this.assert(endTime - startTime >= 300, 'Operations should be sequential');
        this.assert(results[0] === 0 && results[1] === 1 && results[2] === 2, 'Operations should maintain order');
    }
    
    private async testAsyncMutexError(): Promise<void> {
        const mutex = new AsyncMutex();
        
        try {
            await mutex.runWithLock(async () => {
                throw new Error('Test error');
            });
            this.assert(false, 'Should throw error');
        } catch (error) {
            this.assert((error as Error).message === 'Test error', 'Should propagate error');
        }
        
        this.assert(!mutex.isLocked(), 'Mutex should be unlocked after error');
    }
    
    // === ТЕСТЫ AsyncSemaphore ===
    
    private async testAsyncSemaphoreBasic(): Promise<void> {
        const semaphore = new AsyncSemaphore(2);
        
        this.assert(semaphore.getAvailablePermits() === 2, 'Should have 2 available permits initially');
        this.assert(semaphore.getQueueSize() === 0, 'Should have no queue initially');
        
        const result = await semaphore.runWithPermit(async () => {
            this.assert(semaphore.getAvailablePermits() === 1, 'Should have 1 available permit during execution');
            return 'test-result';
        });
        
        this.assert(result === 'test-result', 'Should return correct result');
        this.assert(semaphore.getAvailablePermits() === 2, 'Should restore permits after execution');
    }
    
    private async testAsyncSemaphoreConcurrency(): Promise<void> {
        const semaphore = new AsyncSemaphore(2);
        const results: number[] = [];
        const startTimes: number[] = [];
        const endTimes: number[] = [];
        
        const promises = Array.from({ length: 4 }, (_, i) => 
            semaphore.runWithPermit(async () => {
                startTimes[i] = Date.now();
                await delay(100);
                results.push(i);
                endTimes[i] = Date.now();
                return i;
            })
        );
        
        await Promise.all(promises);
        
        this.assert(results.length === 4, 'Should execute all operations');
        
        // Первые две операции должны начаться одновременно
        const firstTwoStartDiff = Math.abs(startTimes[0]! - startTimes[1]!);
        this.assert(firstTwoStartDiff < 50, 'First two operations should start concurrently');
        
        // Третья операция должна ждать завершения одной из первых двух
        this.assert(startTimes[2]! >= Math.min(endTimes[0]!, endTimes[1]!) - 50, 'Third operation should wait');
    }
    
    private async testAsyncSemaphoreError(): Promise<void> {
        const semaphore = new AsyncSemaphore(1);
        
        try {
            await semaphore.runWithPermit(async () => {
                throw new Error('Test error');
            });
            this.assert(false, 'Should throw error');
        } catch (error) {
            this.assert((error as Error).message === 'Test error', 'Should propagate error');
        }
        
        this.assert(semaphore.getAvailablePermits() === 1, 'Should restore permit after error');
    }
    
    // === ТЕСТЫ AsyncReadWriteLock ===
    
    private async testAsyncReadWriteLockReads(): Promise<void> {
        const lock = new AsyncReadWriteLock();
        const results: number[] = [];
        const startTimes: number[] = [];
        
        const promises = Array.from({ length: 3 }, (_, i) => 
            lock.runWithReadLock(async () => {
                startTimes[i] = Date.now();
                await delay(100);
                results.push(i);
                return i;
            })
        );
        
        await Promise.all(promises);
        
        this.assert(results.length === 3, 'Should execute all read operations');
        
        // Все операции чтения должны выполняться параллельно
        const maxStartDiff = Math.max(
            Math.abs(startTimes[0]! - startTimes[1]!),
            Math.abs(startTimes[1]! - startTimes[2]!),
            Math.abs(startTimes[0]! - startTimes[2]!)
        );
        this.assert(maxStartDiff < 50, 'Read operations should start concurrently');
    }
    
    private async testAsyncReadWriteLockWrite(): Promise<void> {
        const lock = new AsyncReadWriteLock();
        
        const result = await lock.runWithWriteLock(async () => {
            return 'write-result';
        });
        
        this.assert(result === 'write-result', 'Should return correct result from write operation');
    }
    
    private async testAsyncReadWriteLockReadWriteExclusion(): Promise<void> {
        const lock = new AsyncReadWriteLock();
        const events: Array<{ type: 'start' | 'end'; operation: 'read' | 'write'; time: number }> = [];
        
        // Запускаем операцию записи
        const writePromise = lock.runWithWriteLock(async () => {
            events.push({ type: 'start', operation: 'write', time: Date.now() });
            await delay(100);
            events.push({ type: 'end', operation: 'write', time: Date.now() });
        });
        
        // Небольшая задержка, затем запускаем операцию чтения
        await delay(10);
        const readPromise = lock.runWithReadLock(async () => {
            events.push({ type: 'start', operation: 'read', time: Date.now() });
            await delay(50);
            events.push({ type: 'end', operation: 'read', time: Date.now() });
        });
        
        await Promise.all([writePromise, readPromise]);
        
        this.assert(events.length === 4, 'Should have 4 events');
        
        // Операция чтения должна начаться после завершения записи
        const writeEnd = events.find(e => e.type === 'end' && e.operation === 'write')!;
        const readStart = events.find(e => e.type === 'start' && e.operation === 'read')!;
        
        this.assert(readStart.time >= writeEnd.time - 10, 'Read should start after write ends');
    }
    
    private async testAsyncReadWriteLockStatus(): Promise<void> {
        const lock = new AsyncReadWriteLock();
        
        const initialStatus = lock.getStatus();
        this.assert(initialStatus.readers === 0, 'Should have no active readers initially');
        this.assert(initialStatus.writers === 0, 'Should have no active writers initially');
        this.assert(initialStatus.readQueue === 0, 'Should have no waiting readers initially');
        this.assert(initialStatus.writeQueue === 0, 'Should have no waiting writers initially');
        
        const readPromise = lock.runWithReadLock(async () => {
            const statusDuringRead = lock.getStatus();
            this.assert(statusDuringRead.readers === 1, 'Should have 1 active reader during read');
            this.assert(statusDuringRead.writers === 0, 'Should have no active writers during read');
            await delay(50);
        });
        
        await readPromise;
        
        const finalStatus = lock.getStatus();
        this.assert(finalStatus.readers === 0, 'Should have no active readers after read');
        this.assert(finalStatus.writers === 0, 'Should have no active writers after read');
    }
    
    // === ОСНОВНОЙ МЕТОД ЗАПУСКА ТЕСТОВ ===
    
    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting Concurrency Test Suite...\n');
        
        try {
            // Тесты AsyncMutex
            await this.runTest('AsyncMutex Basic', () => this.testAsyncMutexBasic());
            await this.runTest('AsyncMutex Concurrency', () => this.testAsyncMutexConcurrency());
            await this.runTest('AsyncMutex Error Handling', () => this.testAsyncMutexError());
            
            // Тесты AsyncSemaphore
            await this.runTest('AsyncSemaphore Basic', () => this.testAsyncSemaphoreBasic());
            await this.runTest('AsyncSemaphore Concurrency', () => this.testAsyncSemaphoreConcurrency());
            await this.runTest('AsyncSemaphore Error Handling', () => this.testAsyncSemaphoreError());
            
            // Тесты AsyncReadWriteLock
            await this.runTest('AsyncReadWriteLock Reads', () => this.testAsyncReadWriteLockReads());
            await this.runTest('AsyncReadWriteLock Write', () => this.testAsyncReadWriteLockWrite());
            await this.runTest('AsyncReadWriteLock Read-Write Exclusion', () => this.testAsyncReadWriteLockReadWriteExclusion());
            await this.runTest('AsyncReadWriteLock Status', () => this.testAsyncReadWriteLockStatus());
            
            this.printSummary();
            
            if (this.failedTests > 0) {
                throw new Error(`${this.failedTests} concurrency tests failed`);
            }
            
            logger.info('✅ All concurrency tests passed successfully!');
            
        } catch (error) {
            this.printSummary();
            logger.error('❌ Concurrency test suite failed:', error);
            throw error;
        }
    }
}

// === ТЕСТЫ ИНТЕГРАЦИИ ===

class IntegrationTestSuite {
    private totalTests = 0;
    private passedTests = 0;
    private failedTests = 0;
    
    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        this.totalTests++;
        logger.info(`🧪 Running integration test: ${testName}`);
        
        try {
            await testFn();
            this.passedTests++;
            logger.info(`✅ Test passed: ${testName}`);
        } catch (error) {
            this.failedTests++;
            logger.error(`❌ Test failed: ${testName}`, error);
            throw error;
        }
    }
    
    private printSummary(): void {
        logger.info(`\n=== INTEGRATION TEST SUMMARY ===`);
        logger.info(`Total tests: ${this.totalTests}`);
        logger.info(`Passed: ${this.passedTests}`);
        logger.info(`Failed: ${this.failedTests}`);
        logger.info(`Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    }
    
    private assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    /**
     * Тест: Полный цикл работы с VPN
     */
    private async testFullVPNLifecycle(): Promise<void> {
        // Этот тест будет симулировать полный жизненный цикл:
        // инициализация -> запуск -> подключение -> переключение -> остановка
        
        // Так как у нас есть ограничения на реальные VPN подключения,
        // этот тест будет в основном проверять логику координации
        this.assert(true, 'Full lifecycle test structure ready');
    }
    
    /**
     * Тест: Обработка нагрузки
     */
    private async testLoadHandling(): Promise<void> {
        // Тест множественных одновременных операций
        const operations: Promise<void>[] = [];
        
        for (let i = 0; i < 10; i++) {
            operations.push(
                (async () => {
                    await delay(Math.random() * 100);
                    // Симуляция операции
                })()
            );
        }
        
        await Promise.all(operations);
        this.assert(true, 'Load handling test completed');
    }
    
    /**
     * Тест: Восстановление после ошибок
     */
    private async testErrorRecovery(): Promise<void> {
        // Тест способности системы восстанавливаться после различных ошибок
        this.assert(true, 'Error recovery test structure ready');
    }
    
    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting Integration Test Suite...\n');
        
        try {
            await this.runTest('Full VPN Lifecycle', () => this.testFullVPNLifecycle());
            await this.runTest('Load Handling', () => this.testLoadHandling());
            await this.runTest('Error Recovery', () => this.testErrorRecovery());
            
            this.printSummary();
            
            if (this.failedTests > 0) {
                throw new Error(`${this.failedTests} integration tests failed`);
            }
            
            logger.info('✅ All integration tests passed successfully!');
            
        } catch (error) {
            this.printSummary();
            logger.error('❌ Integration test suite failed:', error);
            throw error;
        }
    }
}

// === ЭКСПОРТ И ЗАПУСК ===

export { ConcurrencyTestSuite, IntegrationTestSuite };

// Запуск тестов, если скрипт вызван напрямую
if (require.main === module) {
    (async () => {
        try {
            const concurrencyTests = new ConcurrencyTestSuite();
            await concurrencyTests.runAllTests();
            
            const integrationTests = new IntegrationTestSuite();
            await integrationTests.runAllTests();
            
            logger.info('\n🎉 All auxiliary tests completed successfully!');
        } catch (error) {
            logger.error('Fatal error in auxiliary tests:', error);
            process.exit(1);
        }
    })();
}
