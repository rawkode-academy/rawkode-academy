# Integration Tests for Casting Credits Service

This directory contains integration tests for the Casting Credits service. These tests verify that the service works correctly with real dependencies, such as databases and GraphQL servers.

## Test Categories

### Database Integration Tests (`database.test.ts`)

These tests verify that our database operations work correctly with a real database. We use an in-memory SQLite database to avoid affecting production data.

The tests cover:
- Retrieving casting credits with various filters
- Inserting new casting credits
- Deleting casting credits
- Updating casting credits
- Transaction handling (commit and rollback)

### GraphQL API Integration Tests (`graphql-api.test.ts`)

These tests verify that our GraphQL API works correctly with a real database. We use an in-memory SQLite database to avoid affecting production data.

The tests cover:
- Executing introspection queries
- Handling federation queries
- Resolving the `Video.creditsForRole` field
- Resolving the `CastingCredit.person` field
- Handling HTTP requests
- Error handling

## Running the Tests

To run the integration tests, use the following commands:

```bash
# Run all integration tests
bun test tests/integration

# Run a specific integration test file
bun test tests/integration/database.test.ts
bun test tests/integration/graphql-api.test.ts
```

## Test Environment

The integration tests use an in-memory SQLite database to avoid affecting production data. This allows us to test database operations without setting up a separate test database.

For GraphQL API tests, we create a Yoga server with our schema and test it using both direct resolver calls and HTTP requests.

## Mocking

The GraphQL API tests mock the `client.ts` module to use our test database. This is a simplified approach - in a real implementation, we would use dependency injection or a more sophisticated mocking approach.

## Adding New Tests

When adding new functionality to the service, please add corresponding integration tests to maintain test coverage. Follow the existing patterns for consistency.