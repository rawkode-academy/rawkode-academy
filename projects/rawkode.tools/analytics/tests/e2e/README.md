# Analytics Pipeline E2E Tests

End-to-end tests that validate the entire analytics pipeline from event ingestion to query results.

## Test Coverage

### 1. Health Checks
- Service health endpoints
- R2 connectivity validation

### 2. Event Flow Tests
- Single event ingestion → buffer → storage → query
- Batch event processing
- Concurrent request handling

### 3. Error Handling
- Malformed event rejection
- Payload size limit enforcement
- Batch size validation

### 4. Performance Tests
- Latency requirements (p95 < 100ms)
- Concurrent request handling
- Throughput validation

### 5. Data Integrity
- No event loss during buffer flushes
- Accurate event counting
- Proper event persistence

## Running Tests

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure services are running:
   - Event Collector worker
   - GraphQL API
   - R2 buckets configured

### Local Testing
```bash
npm run test:local
```

### Preview Environment
```bash
npm run test:preview
```

### Custom Environment
```bash
EVENT_COLLECTOR_URL=https://your-collector.workers.dev \
API_URL=https://your-api.workers.dev/graphql \
API_KEY=your-api-key \
npm test
```

## Environment Variables

- `EVENT_COLLECTOR_URL`: URL of the event collector service
- `API_URL`: URL of the GraphQL API
- `API_KEY`: API key for authentication
- `TEST_TIMEOUT`: Override default test timeout (ms)

## Test Strategy

1. **Isolation**: Each test run uses a unique ID to isolate test data
2. **Cleanup**: Tests clean up after themselves when possible
3. **Retries**: Critical checks use retry logic with timeouts
4. **Validation**: Multiple validation points throughout the pipeline

## Debugging Failed Tests

1. Check service logs:
   ```bash
   wrangler tail analytics-event-collector
   ```

2. Verify R2 bucket contents:
   ```bash
   wrangler r2 object list analytics-source
   ```

3. Enable verbose logging:
   ```bash
   DEBUG=* npm test
   ```

## Adding New Tests

1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Add appropriate timeouts for async operations
5. Clean up test data when possible