# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.2] - 2025-07-09

### Fixed
- **Logger Lazy Initialization**: Fixed ENOENT error when logger module is imported but not used
- **Logger Architecture**: Changed logger exports to classes instead of instances to prevent unwanted initialization
- **File System Dependencies**: Logger now only creates logs directory when actually instantiated and used

### Enhanced
- **Import Safety**: Logger module can now be safely imported without side effects
- **Memory Efficiency**: Logger instances are only created when explicitly needed
- **TypeScript Types**: Improved type safety in logger test files

### Breaking Changes
- **Logger Import**: Logger is now exported as classes (`FileLogger`, `NullLogger`) instead of instances
- **Usage Update**: Must instantiate logger with `new FileLogger()` instead of importing instance

### Migration Guide
```typescript
// Old way (no longer works)
import { logger, nullLogger } from './utils/logger';

// New way
import { FileLogger, NullLogger } from './utils/logger';
const logger = new FileLogger();
const nullLogger = new NullLogger();
```

## [1.5.1] - 2025-07-08

### Fixed
- **Failover Tests**: Added intelligent skipping for failover tests when only one proxy is available
- **Test Documentation**: Enhanced documentation to explain failover test behavior with single proxy configuration

### Enhanced
- **Test Robustness**: Failover tests now gracefully handle single-proxy configurations instead of failing
- **User Experience**: Clear messaging when failover tests are skipped due to insufficient proxy count
- **Documentation**: Added notes about failover test requirements in README.md

### Testing
- **Intelligent Test Skipping**: Failover tests automatically skip with informative messages when < 2 proxies available
- **Better Test Feedback**: Users now understand why certain tests are skipped in single-proxy setups

## [1.5.0] - 2025-07-08

### Added
- **Full OpenAI SDK Integration**: ProxyManager now works as a drop-in replacement for fetch in OpenAI SDK
- **Automatic Headers Conversion**: Seamless conversion between Headers objects and plain objects for fetch compatibility
- **Auto-bound Methods**: `request` method is automatically bound in constructor, no need for manual `.bind()`
- **Comprehensive OpenAI Documentation**: Added detailed integration examples for both English and Russian documentation

### Enhanced
- **Fetch API Compatibility**: Enhanced response object to be fully fetch-compatible with Headers support
- **ProxyRequest Response**: Improved response handling with proper Headers object methods (get, has, entries, etc.)
- **Error Handling**: Better error context preservation during proxy request failures

### Testing
- **OpenAI Integration Test**: Added comprehensive test for OpenAI SDK integration
- **Headers Compatibility Test**: Validated automatic Headers conversion functionality
- **Bind Context Test**: Verified auto-bound method behavior

### Documentation
- **OpenAI Integration Guide**: Complete integration examples with configuration recommendations
- **Fetch Compatibility**: Updated documentation to reflect full fetch API compatibility
- **Russian Translation**: Added Russian documentation for OpenAI integration

## [1.2.0] - 2025-07-03

### Added
- Disable logging feature
- tests refactoring and perfomance
- bugfixes

### Testing
- All integration tests passing
- Performance benchmarks added
- Comprehensive test suite validation

## [1.1.0] - Previous version
- Proxy connection management
- Health checking functionality  
- Fetch-like API
- Dante socks5 proxy integration
- Logger with Sentry support
- Basic snowflake ID generation
