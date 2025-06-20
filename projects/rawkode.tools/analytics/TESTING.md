# Analytics Testing Guide

This document describes the comprehensive testing strategy for the analytics platform.

## Quick Start

```bash
# Run all unit tests
just test-unit

# Run all tests (unit + lint + security)
just test-all

# Run integration tests (starts services automatically)
just test-integration

# Run specific test suites
just test-ts              # TypeScript tests
just test-rust            # All Rust tests
just test-dbt             # dbt data quality tests
just test-e2e             # End-to-end tests
```

## Test Organization

### 1. Unit Tests

#### TypeScript (API)
- **Location**: `/api/**/*.test.ts`
- **Framework**: Vitest
- **Coverage**: 80% minimum
- **Run**: `just test-ts` or `just test-ts-coverage`

#### Rust (Workers)
- **Event Collector**: `/pipeline/event-collector/src/*_test.rs`
- **Compaction Worker**: `/pipeline/compaction-worker/src/tests.rs`
- **Catalog Worker**: `/pipeline/catalog-worker/src/tests.rs`
- **Framework**: Rust built-in + wasm-bindgen-test
- **Run**: `just test-rust`

#### dbt (Data Quality)
- **Location**: `/dbt/tests/*.sql`
- **Tests**: Data completeness, duplicates, timestamps, consistency
- **Run**: `just test-dbt`

### 2. Integration Tests

#### E2E Pipeline Tests
- **Location**: `/tests/e2e/analytics-pipeline.test.ts`
- **Coverage**: Full pipeline from ingestion to query
- **Run**: `just test-e2e` (requires running services)

### 3. Health Monitoring

#### Health Checker Worker
- **Location**: `/monitoring/health-checker`
- **Purpose**: Continuous synthetic monitoring
- **Checks**: Service health, event flow, R2 connectivity
- **Schedule**: Every 5 minutes via cron

## Manual Testing

```bash
# Test health endpoint
just test-health

# Send single test event
just test-single-event

# Send batch events
just test-batch-events

# Test unauthorized access
just test-unauthorized

# Run all manual tests
just test-manual
```

## Development Workflow

### Running Services Locally

```bash
# Start event collector
just dev

# Start all services
just dev-all

# Deploy to production
just deploy
```

### Code Quality

```bash
# Run linting
just lint

# Check Rust formatting
just fmt-check

# Security checks
just security-check
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/test.yml`) runs:

1. **Unit Tests**: All TypeScript and Rust tests
2. **Integration Tests**: E2E tests with local services
3. **Security Scans**: Trivy vulnerability scanner
4. **Code Quality**: Biome linting, Rust formatting
5. **Build Verification**: All workers compile successfully

## Test Data

### Synthetic Events
- Type: `analytics.synthetic.health_check`
- Source: `health-checker` or `e2e-test-suite`
- Purpose: Continuous validation without affecting real metrics

### Test Event Types
- `analytics.test.e2e` - E2E test events
- `com.example.test` - Manual testing
- `com.example.batch.test` - Batch testing

## Coverage Requirements

| Component | Target | Current |
|-----------|--------|---------|
| API (TypeScript) | 80% | ✅ |
| Event Collector | 70% | ✅ |
| Compaction Worker | 70% | ✅ |
| Catalog Worker | 60% | ✅ |
| E2E Tests | N/A | ✅ |

## Debugging Failed Tests

### Local Debugging

```bash
# View worker logs
wrangler tail analytics-event-collector

# Check R2 contents
wrangler r2 object list analytics-source

# Debug specific test
cd tests/e2e && npm test -- --grep "specific test name"
```

### CI Debugging

1. Check GitHub Actions logs
2. Download artifacts for failed builds
3. Review coverage reports in Codecov

## Adding New Tests

### Unit Test Template

```typescript
// TypeScript
describe('Feature', () => {
  it('should do something', async () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = await feature(input);
    
    // Assert
    expect(result).toMatchObject({ success: true });
  });
});
```

```rust
// Rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature() {
        // Arrange
        let input = create_test_input();
        
        // Act
        let result = feature(input);
        
        // Assert
        assert_eq!(result, expected);
    }
}
```

### E2E Test Template

```typescript
it('should handle end-to-end flow', async () => {
  // 1. Send event
  const event = await sendEvent(testData);
  
  // 2. Verify processing
  await waitForCondition(async () => {
    const status = await checkStatus();
    return status.processed;
  });
  
  // 3. Query results
  const results = await queryData();
  expect(results).toContainEvent(event);
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Remove test data after completion
3. **Timeouts**: Set appropriate timeouts for async operations
4. **Retries**: Use retry logic for flaky operations
5. **Descriptive Names**: Use clear test descriptions
6. **Small Tests**: Keep tests focused on single behaviors

## Troubleshooting

### Common Issues

1. **Services not running**: Run `just dev-all` before integration tests
2. **R2 permissions**: Ensure wrangler is authenticated
3. **Timeout errors**: Increase test timeouts in vitest.config.ts
4. **Flaky tests**: Add retry logic or increase wait times

### Getting Help

- Check logs: `wrangler tail <worker-name>`
- Review CI output: GitHub Actions logs
- Debug locally: Run tests with `--inspect` flag