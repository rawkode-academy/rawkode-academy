# Integration Tests

This directory contains integration tests for the Emoji Reactions service. These tests interact with a real database and test the full functionality of the service.

## Test Categories

### Database Integration Tests (`database.test.ts`)

Tests for database operations with a real D1 database:
- Adding emoji reactions
- Removing emoji reactions
- Retrieving reactions with various filters
- Handling duplicate reactions
- Transaction handling

### GraphQL API Integration Tests (`graphql-api.test.ts`)

Tests for the GraphQL API with a real database:
- Executing queries and mutations
- Federation support
- Error handling
- HTTP request/response handling

### GraphQL Federation Tests (`graphql-federation.test.ts`)

Tests for federation-specific functionality:
- Entity resolution for Video and Episode types
- Field extensions
- Federation directives

### GraphQL Validation Tests (`graphql-validation.test.ts`)

Tests for input validation and error handling:
- Emoji validation (ensuring valid emoji characters)
- ID validation
- Timestamp validation
- Error messages

## Running Integration Tests

Integration tests require a test database to be set up. The tests use Miniflare to simulate the Cloudflare Workers environment.

```bash
# Run all integration tests
bun test tests/integration

# Run specific integration test file
bun test tests/integration/database.test.ts

# Run with verbose output
bun test tests/integration --verbose
```

## Test Database

The integration tests use an in-memory SQLite database provided by Miniflare. The database is:
- Created fresh for each test run
- Migrated with the latest schema
- Cleaned up after tests complete

## Writing New Integration Tests

When adding new integration tests:
1. Use the global `env` object to access the test database
2. Clean up test data after each test
3. Test both success and failure cases
4. Include edge cases and boundary conditions