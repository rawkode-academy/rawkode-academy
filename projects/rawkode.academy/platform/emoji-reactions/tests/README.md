# Emoji Reactions Service Tests

This directory contains tests for the Emoji Reactions service.

## Test Structure

The tests are organized into the following categories:

### Unit Tests

1. **Schema Tests** (`graphqlSchema.test.ts`): Tests for the GraphQL schema structure.
2. **Resolver Tests** (`graphqlResolvers.test.ts`): Tests for the GraphQL resolvers.
3. **Yoga Tests** (`graphqlYoga.test.ts`): Basic tests for the GraphQL server setup.
4. **Database Schema Tests** (`drizzleSchema.test.ts`): Tests for the database schema definition.

### Integration Tests (`/integration`)

1. **Database Integration Tests** (`integration/database.test.ts`): Tests for database operations with a real database.
2. **GraphQL API Integration Tests** (`integration/graphql-api.test.ts`): Tests for the GraphQL API with a real database.
3. **GraphQL Federation Tests** (`integration/graphql-federation.test.ts`): Tests for federation functionality.
4. **GraphQL Validation Tests** (`integration/graphql-validation.test.ts`): Tests for input validation and error handling.

See the [Integration Tests README](./integration/README.md) for more details.

## Running Tests

To run the tests, use the following commands:

```bash
# Run all tests
bun test

# Run only unit tests
bun test --pattern "*.test.ts" --ignore "tests/integration/**"

# Run only integration tests
bun test tests/integration

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Current Test Coverage

The current tests focus on verifying the structure and functionality of the service:

### Unit Tests

1. **Schema Tests**: Verify that the GraphQL schema has the expected types and fields.
2. **Resolver Tests**: Verify that the resolvers return the expected data.
3. **Yoga Tests**: Verify that the GraphQL server can be created successfully.
4. **Database Schema Tests**: Verify that the database schema is defined correctly.

### Integration Tests

1. **Database Integration Tests**: Verify that database operations work correctly with a real database.
   - Adding and removing emoji reactions
   - Retrieving reactions with various filters
   - Handling duplicate reactions
   - Transaction handling (commit and rollback)

2. **GraphQL API Integration Tests**: Verify that the GraphQL API works correctly with a real database.
   - Executing introspection queries
   - Handling federation queries
   - Resolving GraphQL fields
   - Handling HTTP requests
   - Error handling

3. **GraphQL Federation Tests**: Verify federation functionality.
   - Entity resolution
   - Field extensions
   - Federation directives

4. **GraphQL Validation Tests**: Verify input validation and error handling.
   - Emoji validation
   - ID validation
   - Timestamp validation

## Future Test Improvements

The following improvements could be made to the test suite:

1. **End-to-End Tests**: Add tests that simulate real-world usage of the service, including interactions with other services.
2. **Performance Tests**: Add tests to verify the performance of the service under load.
3. **Reaction Analytics Tests**: Add tests for analytics queries (most popular emojis, reaction counts, etc.).

## Adding New Tests

When adding new functionality to the service, please add corresponding tests to maintain test coverage. Follow the existing patterns for consistency.