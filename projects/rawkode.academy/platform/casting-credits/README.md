---
runme:
  version: v3
shell: bash
---

# Casting Credits Service

The Casting Credits service manages the relationship between people, their roles (host, guest, etc.), and videos. It provides a GraphQL API that integrates with the federated graph.

## Local Development

### Database

```sh {"background":"true","name":"dev-db"}
bun run wrangler d1 migrations apply platform-casting-credits
```

### Read Model

```sh {"name":"read-model"}
bun run wrangler dev
```

### Checks, Formatting, & Linting

```sh {"name":"check"}
bun run biome format
bun run biome lint
```

### Testing

```sh {"name":"test"}
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

The test suite includes both unit tests and integration tests:

- **Unit Tests**: Verify the basic functionality of the service components in isolation.
- **Integration Tests**: Verify that the service works correctly with real dependencies, including database operations and GraphQL API functionality.

## Architecture

The service consists of two main components:

1. **Data Model**: Defines the database schema and provides migration utilities.
2. **Read Model**: Exposes the data through a GraphQL API that integrates with the federated graph.

### Data Model

The data model uses Drizzle ORM with Cloudflare D1 (SQLite). It defines a `casting_credits` table that links people, roles, and videos.

### Read Model

The read model uses Pothos GraphQL to define a federated GraphQL schema. It extends the `Video` type to add a `creditsForRole` field that returns casting credits for a specific role.

## Testing

The service includes comprehensive tests for both the data model and GraphQL API:

### Unit Tests

- **Schema Tests**: Verify that the GraphQL schema has the expected types and fields.
- **Resolver Tests**: Verify that the resolvers return the expected data.
- **Basic Integration Tests**: Verify that the GraphQL server can be created successfully.
- **Database Schema Tests**: Verify that the database schema is defined correctly.

### Integration Tests

- **Database Integration Tests**: Verify that database operations work correctly with a real database.
- **GraphQL API Integration Tests**: Verify that the GraphQL API works correctly with a real database.

See the [tests/README.md](./tests/README.md) for more details on the test structure and how to run the tests.
