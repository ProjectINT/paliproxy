#!/usr/bin/env node

import { logger, SeverityLevel } from './logger';

// Demo script to show logger functionality
async function demoLogger() {
    console.log('🚀 Logger Demo Started');
    
    // Set application context
    logger.setTags({
        environment: 'development',
        version: '1.0.0',
        component: 'demo'
    });

    logger.setUser({
        id: 'demo-user',
        username: 'demo',
        email: 'demo@palivpn.com'
    });

    // Basic logging
    logger.captureMessage('Demo application started', SeverityLevel.Info);
    
    // Add breadcrumbs
    logger.addBreadcrumb({
        message: 'User initiated demo',
        category: 'user_action',
        level: SeverityLevel.Info
    });

    // Simulate some application flow
    logger.setExtra('step', 1);
    logger.captureMessage('Initializing components', SeverityLevel.Info);

    logger.addBreadcrumb({
        message: 'Components initialized',
        category: 'system',
        level: SeverityLevel.Info
    });

    // Simulate a warning
    logger.setExtra('step', 2);
    logger.captureMessage('Configuration file not found, using defaults', SeverityLevel.Warning);

    // Simulate an error with context
    logger.withScope((scope) => {
        scope.setTag('operation', 'network_test');
        scope.setExtra('attempt', 1);
        scope.addBreadcrumb({
            message: 'Attempting network connection',
            category: 'network',
            level: SeverityLevel.Info
        });

        // Simulate exception
        try {
            throw new Error('Network timeout after 5 seconds');
        } catch (error) {
            logger.captureException(error as Error, {
                timeout: 5000,
                server: '192.168.1.1',
                port: 8080
            });
        }
    });

    // Final message
    logger.captureMessage('Demo completed', SeverityLevel.Info);
    
    console.log('✅ Logger Demo Completed');
    console.log('📝 Check ./logs/app.log for the generated logs');
}

// Run the demo
demoLogger().catch((error) => {
    console.error('Demo failed:', error);
    logger.captureException(error);
});
