// Test setup file
// This file contains common setup for tests

// Mock console methods to reduce noise during tests (optional)
const originalConsole = { ...console };

export function suppressConsole() {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: originalConsole.error // Keep error for debugging
  };
}

export function restoreConsole() {
  global.console = originalConsole;
}

// Export original console for tests that need it
export { originalConsole };
