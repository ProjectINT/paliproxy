/**
 * Основной файл для запуска всех тестов VPNManager
 */

import { logger } from '../utils';
import { VPNManagerTestSuite } from './manager.test';
import { ConcurrencyTestSuite, IntegrationTestSuite } from './auxiliary.test';
import { HealthCheckerTestSuite } from './healthChecker.test';
import { ChannelSwitchManagerTestSuite } from './channelSwitchManager.test';

/**
 * Основной класс для запуска всех тестов
 */
class AllTestsRunner {
    private totalSuites = 0;
    private passedSuites = 0;
    private failedSuites = 0;
    private startTime = 0;
    
    /**
     * Запуск одного тестового suite
     */
    private async runTestSuite(suiteName: string, suiteRunner: () => Promise<void>): Promise<void> {
        this.totalSuites++;
        logger.info(`\n🔍 Starting test suite: ${suiteName}`);
        logger.info('='.repeat(50));
        
        try {
            await suiteRunner();
            this.passedSuites++;
            logger.info(`✅ Test suite completed successfully: ${suiteName}`);
        } catch (error) {
            this.failedSuites++;
            logger.error(`❌ Test suite failed: ${suiteName}`, error);
            throw error;
        }
    }
    
    /**
     * Вывод итогового отчета
     */
    private printFinalReport(): void {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        logger.info('\n' + '='.repeat(60));
        logger.info('🎯 FINAL TEST REPORT');
        logger.info('='.repeat(60));
        logger.info(`Total test suites: ${this.totalSuites}`);
        logger.info(`Passed suites: ${this.passedSuites}`);
        logger.info(`Failed suites: ${this.failedSuites}`);
        logger.info(`Success rate: ${((this.passedSuites / this.totalSuites) * 100).toFixed(1)}%`);
        logger.info(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);
        logger.info('='.repeat(60));
        
        if (this.failedSuites === 0) {
            logger.info('🎉 ALL TESTS PASSED! 🎉');
        } else {
            logger.error(`💥 ${this.failedSuites} test suite(s) failed!`);
        }
    }
    
    /**
     * Запуск всех тестов
     */
    async runAllTests(): Promise<void> {
        this.startTime = Date.now();
        
        logger.info('🚀 Starting PaliVPN Test Suite');
        logger.info('Testing all components of VPNManager and related classes');
        logger.info('='.repeat(60));
        
        try {
            // 1. Тесты примитивов конкурентности
            await this.runTestSuite('Concurrency Primitives', async () => {
                const suite = new ConcurrencyTestSuite();
                await suite.runAllTests();
            });
            
            // 2. Тесты HealthChecker
            await this.runTestSuite('HealthChecker', async () => {
                const suite = new HealthCheckerTestSuite();
                await suite.runAllTests();
            });
            
            // 3. Тесты ChannelSwitchManager
            await this.runTestSuite('ChannelSwitchManager', async () => {
                const suite = new ChannelSwitchManagerTestSuite();
                await suite.runAllTests();
            });
            
            // 4. Основные тесты VPNManager
            await this.runTestSuite('VPNManager Core', async () => {
                const suite = new VPNManagerTestSuite();
                await suite.runAllTests();
            });
            
            // 5. Интеграционные тесты
            await this.runTestSuite('Integration Tests', async () => {
                const suite = new IntegrationTestSuite();
                await suite.runAllTests();
            });
            
            this.printFinalReport();
            
            if (this.failedSuites > 0) {
                throw new Error(`${this.failedSuites} test suite(s) failed`);
            }
            
        } catch (error) {
            this.printFinalReport();
            throw error;
        }
    }
}

/**
 * Запуск быстрых тестов (только unit-тесты)
 */
async function runQuickTests(): Promise<void> {
    logger.info('⚡ Running Quick Tests (Unit Tests Only)');
    logger.info('='.repeat(50));
    
    try {
        // Только тесты примитивов конкурентности
        const concurrencyTests = new ConcurrencyTestSuite();
        await concurrencyTests.runAllTests();
        
        logger.info('\n✅ Quick tests completed successfully!');
    } catch (error) {
        logger.error('\n❌ Quick tests failed:', error);
        throw error;
    }
}

/**
 * Запуск тестов определенного компонента
 */
async function runComponentTests(component: string): Promise<void> {
    logger.info(`🔧 Running ${component} Tests`);
    logger.info('='.repeat(50));
    
    try {
        switch (component.toLowerCase()) {
            case 'concurrency': {
                const concurrencyTests = new ConcurrencyTestSuite();
                await concurrencyTests.runAllTests();
                break;
            }
                
            case 'healthchecker': {
                const healthTests = new HealthCheckerTestSuite();
                await healthTests.runAllTests();
                break;
            }
                
            case 'channelswitchmanager':
            case 'channelswitch': {
                const channelSwitchTests = new ChannelSwitchManagerTestSuite();
                await channelSwitchTests.runAllTests();
                break;
            }
                
            case 'manager':
            case 'vpnmanager': {
                const managerTests = new VPNManagerTestSuite();
                await managerTests.runAllTests();
                break;
            }
                
            case 'integration': {
                const integrationTests = new IntegrationTestSuite();
                await integrationTests.runAllTests();
                break;
            }
                
            default:
                throw new Error(`Unknown component: ${component}. Available: concurrency, healthchecker, manager, integration`);
        }
        
        logger.info(`\n✅ ${component} tests completed successfully!`);
    } catch (error) {
        logger.error(`\n❌ ${component} tests failed:`, error);
        throw error;
    }
}

// === MAIN ФУНКЦИЯ ===

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'quick':
                await runQuickTests();
                break;
                
            case 'component': {
                const component = args[1];
                if (!component) {
                    throw new Error('Component name required. Usage: npm test component <component-name>');
                }
                await runComponentTests(component);
                break;
            }
                
            case 'all':
            case undefined: {
                const runner = new AllTestsRunner();
                await runner.runAllTests();
                break;
            }
                
            case 'help':
            case '--help':
            case '-h':
                logger.info('PaliVPN Test Runner');
                logger.info('Usage: npm test [command] [options]');
                logger.info('');
                logger.info('Commands:');
                logger.info('  all          Run all tests (default)');
                logger.info('  quick        Run only quick unit tests');
                logger.info('  component    Run tests for specific component');
                logger.info('  help         Show this help message');
                logger.info('');
                logger.info('Components for "component" command:');
                logger.info('  concurrency        Test concurrency primitives');
                logger.info('  healthchecker      Test HealthChecker class');
                logger.info('  channelswitch      Test ChannelSwitchManager class');
                logger.info('  manager            Test VPNManager class');
                logger.info('  integration        Test integration scenarios');
                logger.info('');
                logger.info('Examples:');
                logger.info('  npm test                      # Run all tests');
                logger.info('  npm test quick               # Run quick tests');
                logger.info('  npm test component manager   # Test VPNManager only');
                break;
                
            default:
                throw new Error(`Unknown command: ${command}. Use "help" for usage information.`);
        }
        
    } catch (error) {
        logger.error('Test runner failed:', error);
        process.exit(1);
    }
}

// === ЭКСПОРТ И ЗАПУСК ===

export { AllTestsRunner, runQuickTests, runComponentTests };

// Запуск, если скрипт вызван напрямую
if (require.main === module) {
    main();
}
