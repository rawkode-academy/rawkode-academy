# Test Suite for Zitadel-Zulip Connector

This directory contains comprehensive tests for the Zitadel-Zulip connector service. The tests cover all major functionality including user provisioning, updating, and the Zulip API client.

## Test Structure

```
tests/
├── helpers/
│   └── mocks.ts           # Mock classes and utilities
├── handlers/
│   ├── provision.test.ts  # Tests for user provisioning
│   └── update.test.ts     # Tests for user updates
├── zulip.test.ts          # Tests for ZulipClient
└── README.md             # This file
```

## Running Tests

```bash
# Run all tests
bun test

# Run tests with watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Test Coverage

### 1. Provision Handler (`tests/handlers/provision.test.ts`)

**✅ Successful Provisioning:**
- Creating new users when they don't exist in Zulip
- Handling existing Zulip users that aren't mapped
- Returning existing mappings for already provisioned users
- Sending welcome messages to new users
- Storing bidirectional user mappings

**✅ Error Handling:**
- Invalid request bodies
- Missing required fields
- Invalid email formats
- Zulip user creation failures
- User retrieval failures after creation
- KV storage errors
- JSON parsing errors

**✅ Edge Cases:**
- Empty string names
- Very long names
- Special characters in names (unicode, apostrophes, hyphens)
- Optional fields being undefined

**✅ Data Integrity:**
- Consistent mapping data storage
- Proper timestamp handling
- Bidirectional mapping creation

### 2. Update Handler (`tests/handlers/update.test.ts`)

**✅ Successful Updates:**
- Updating user names while preserving existing data
- Email updates with proper mapping management
- Partial name updates (firstName only, lastName only)
- Active status changes
- Handling no-op updates

**✅ Error Handling:**
- User not provisioned scenarios
- Invalid request bodies
- Missing required fields
- Zulip API errors
- KV storage errors

**✅ Edge Cases:**
- Empty string names
- Special characters in names
- Same email updates (no-op)

**✅ Data Integrity:**
- Mapping timestamp updates
- Preserving existing mapping data
- Email mapping updates

### 3. ZulipClient (`tests/zulip.test.ts`)

**✅ Core Functionality:**
- User retrieval by email and ID
- User creation with secure password generation
- User updates
- Stream subscriptions
- Private message sending

**✅ Authentication:**
- Correct Basic Auth header generation
- Proper API endpoint construction

**✅ Error Handling:**
- HTTP error responses
- Network failures
- Invalid responses

**✅ Security:**
- Secure password generation using crypto.randomUUID()
- Different passwords for each user creation

## Mock Infrastructure

### MockKVNamespace
- Simulates Cloudflare KV storage
- Supports get, put, delete operations
- Memory-based storage for testing
- Proper cleanup between tests

### MockZulipClient
- Full implementation of ZulipClient interface
- Tracks all API calls for verification
- Supports simulation of various failure scenarios
- Memory-based user storage

### Test Utilities
- `createMockEnv()` - Creates test environment configuration
- `createTestContext()` - Creates Hono-compatible context for testing
- Sample test data (users, mappings, requests)

## Key Testing Patterns

### 1. Isolated Tests
Each test is completely isolated with fresh mocks and data:

```typescript
beforeEach(() => {
  mockZulipClient = new MockZulipClient();
  mockEnv = createMockEnv();
  mockKV = mockEnv.USER_MAPPINGS as unknown as MockKVNamespace;
  mockKV.clear();
});
```

### 2. API Call Verification
Tests verify the exact API calls made:

```typescript
// Verify Zulip API calls
expect(mockZulipClient.apiCalls).toHaveLength(3);
expect(mockZulipClient.apiCalls[0].method).toBe('getUserByEmail');
expect(mockZulipClient.apiCalls[1].method).toBe('createUser');
expect(mockZulipClient.apiCalls[2].method).toBe('sendPrivateMessage');
```

### 3. Error Simulation
Tests can simulate various error conditions:

```typescript
mockZulipClient.simulateCreateUserFailure(true);
// or
mockKV.put = async () => {
  throw new Error('KV storage failed');
};
```

### 4. Data Verification
Tests verify both response data and storage side effects:

```typescript
// Verify response
expect(response.data.status).toBe('success');
expect(response.data.zulipUserId).toBe(1001);

// Verify storage
const userMapping = await mockKV.get('user:zitadel-123');
expect(userMapping).toBeTruthy();
```

## Test Data

### Sample Valid Request
```typescript
const validRequest: ProvisionUserRequest = {
  zitadelUserId: 'zitadel-123',
  email: 'newuser@example.com',
  firstName: 'John',
  lastName: 'Doe',
  preferredUsername: 'johndoe',
  metadata: { department: 'engineering' },
};
```

### Sample User Mapping
```typescript
const testUserMapping: UserMapping = {
  zitadelUserId: 'zitadel-123',
  zulipUserId: 1001,
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};
```

## Benefits of This Test Suite

1. **Comprehensive Coverage**: Tests cover happy paths, error conditions, and edge cases
2. **Realistic Scenarios**: Mock implementations closely match real service behavior
3. **Fast Execution**: All tests run in memory without external dependencies
4. **Easy Debugging**: Clear test structure and meaningful assertions
5. **Maintainable**: Well-organized with reusable utilities and clear patterns
6. **Type Safety**: Full TypeScript support with proper type checking

## Future Enhancements

- Integration tests with real Zulip sandbox environment
- Performance tests for high-volume user operations
- End-to-end tests with Zitadel webhook simulation
- Property-based testing for input validation
- Benchmarks for KV operations and API calls
