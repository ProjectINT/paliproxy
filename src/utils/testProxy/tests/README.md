# Tests

Integration tests for project utilities.

## Running

```bash
# Test testProxy function
npx ts-node src/tests/testProxy.test.ts

# All tests
npx ts-node src/tests/runTests.ts
```

## testProxy.test.ts

9 tests for `testProxy` function:
- ✅ Invalid proxies and hosts
- ✅ Configuration format and special characters
- ✅ Timeout and custom URL
- ✅ Result format and parallel requests

**Features**: Uses built-in `assert`, real network tests, no external dependencies.
