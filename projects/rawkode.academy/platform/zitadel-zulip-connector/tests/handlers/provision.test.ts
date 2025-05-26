import { describe, it, expect, beforeEach } from 'bun:test';
import { provisionUser } from '../../src/handlers/provision';
import {
  MockZulipClient,
  MockZitadelClient,
  type MockKVNamespace,
  createMockEnv,
  testZitadelUser
} from '../helpers/mocks';
import type { ProvisionUserRequest } from '../../src/types';

// Simple mock context that matches what Hono expects
function createTestContext(env: unknown, zulipClient: MockZulipClient, zitadelClient: MockZitadelClient, requestBody: unknown) {
  let jsonResponse: unknown = null;
  let statusCode = 200;

  return {
    env,
    get: (key: string) => {
      if (key === 'zulipClient') return zulipClient;
      if (key === 'zitadelClient') return zitadelClient;
      return undefined;
    },
    set: () => {},
    req: {
      json: async () => requestBody,
    },
    json: (data: unknown, status?: number) => {
      jsonResponse = data;
      statusCode = status || 200;
      return { _getJsonData: () => jsonResponse, _getStatus: () => statusCode };
    },
    _getLastResponse: () => ({ data: jsonResponse, status: statusCode }),
  } as never;
}

describe('provisionUser', () => {
  let mockZulipClient: MockZulipClient;
  let mockZitadelClient: MockZitadelClient;
  let mockKV: MockKVNamespace;
  let mockEnv: ReturnType<typeof createMockEnv>;

  const validRequest: ProvisionUserRequest = {
    zitadelUserId: 'zitadel-123',
  };

  beforeEach(() => {
    mockZulipClient = new MockZulipClient();
    mockZitadelClient = new MockZitadelClient();
    mockEnv = createMockEnv();
    mockKV = mockEnv.USER_MAPPINGS as unknown as MockKVNamespace;
    mockKV.clear();

    // Add the test user to Zitadel client
    mockZitadelClient.addUser(testZitadelUser);
  });

  describe('successful provisioning', () => {
    it('should provision a new user when they do not exist in Zulip', async () => {
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
      expect(response.data.created).toBe(true);
      expect(response.data.email).toBe('newuser@example.com');
      expect(response.data.zulipUserId).toBe(1001);

      // Verify Zitadel API calls
      expect(mockZitadelClient.apiCalls).toHaveLength(1);
      expect(mockZitadelClient.apiCalls[0].method).toBe('getUserById');
      expect(mockZitadelClient.apiCalls[0].args[0]).toBe('zitadel-123');

      // Verify Zulip API calls - getUserByEmail is called twice (check + after creation)
      expect(mockZulipClient.apiCalls).toHaveLength(4);
      expect(mockZulipClient.apiCalls[0].method).toBe('getUserByEmail');
      expect(mockZulipClient.apiCalls[1].method).toBe('createUser');
      expect(mockZulipClient.apiCalls[2].method).toBe('getUserByEmail');
      expect(mockZulipClient.apiCalls[3].method).toBe('sendPrivateMessage');

      // Verify user creation call
      const createUserCall = mockZulipClient.apiCalls[1];
      expect(createUserCall.args[0]).toEqual({
        email: 'newuser@example.com',
        full_name: 'John Doe',
      });

      // Verify welcome message call
      const welcomeCall = mockZulipClient.apiCalls[3];
      expect(welcomeCall.args[0]).toBe('newuser@example.com');
      expect((welcomeCall.args[1] as string).includes('Welcome to Rawkode Academy')).toBe(true);

      // Verify KV storage
      const userMapping = await mockKV.get('user:zitadel-123');
      expect(userMapping).toBeTruthy();
      if (userMapping) {
        const mapping = JSON.parse(userMapping);
        expect(mapping.zitadelUserId).toBe('zitadel-123');
        expect(mapping.zulipUserId).toBe(1001);
        expect(mapping.email).toBe('newuser@example.com');
      }

      const emailMapping = await mockKV.get('email:newuser@example.com');
      expect(emailMapping).toBe('zitadel-123');
    });

    it('should return existing mapping when user is already provisioned', async () => {
      // Pre-populate KV with existing mapping
      const existingMapping = {
        zitadelUserId: 'zitadel-123',
        zulipUserId: 2001,
        email: 'newuser@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      await mockKV.put('user:zitadel-123', JSON.stringify(existingMapping));

      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);
      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('already_exists');
      expect(response.data.zulipUserId).toBe(2001);
      expect(response.data.email).toBe('newuser@example.com');

      // Should not make any API calls
      expect(mockZulipClient.apiCalls).toHaveLength(0);
      expect(mockZitadelClient.apiCalls).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid request body', async () => {
      const invalidRequest = { invalid: 'data' };
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, invalidRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toBeTruthy();
    });

    it('should handle missing zitadelUserId', async () => {
      const invalidRequest = {};
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, invalidRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toBeTruthy();
    });

    it('should handle user not found in Zitadel', async () => {
      mockZitadelClient.simulateGetUserFailure(true);
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toContain('User not found in Zitadel');
    });

    it('should handle Zulip user creation failure', async () => {
      mockZulipClient.simulateCreateUserFailure(true);
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toContain('Failed to create user');
    });

    it('should handle case where user creation succeeds but user retrieval fails', async () => {
      // Mock a scenario where createUser succeeds but getUserByEmail returns null
      let callCount = 0;
      const originalGetUserByEmail = mockZulipClient.getUserByEmail.bind(mockZulipClient);
      mockZulipClient.getUserByEmail = async (email: string) => {
        callCount++;
        if (callCount === 1) {
          // First call - user doesn't exist
          return null;
        }
        // Second call after creation - still returns null (simulating failure)
        return null;
      };

      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);
      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toBe('Failed to retrieve created user');

      // Restore original method
      mockZulipClient.getUserByEmail = originalGetUserByEmail;
    });

    it('should handle KV storage errors gracefully', async () => {
      // Mock KV put to throw an error
      const originalPut = mockKV.put.bind(mockKV);
      mockKV.put = async () => {
        throw new Error('KV storage failed');
      };

      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);
      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(400);
      expect(response.data.status).toBe('error');
      expect(response.data.error).toContain('KV storage failed');

      // Restore original method
      mockKV.put = originalPut;
    });
  });

  describe('name handling', () => {
    it('should use displayName when available', async () => {
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');

      // Verify user was created with displayName
      const createUserCall = mockZulipClient.apiCalls[1];
      expect(createUserCall.args[0]).toEqual({
        email: 'newuser@example.com',
        full_name: 'John Doe',
      });
    });

    it('should fallback to givenName + familyName when displayName is empty', async () => {
      const userWithoutDisplayName = {
        ...testZitadelUser,
        displayName: '',
      };
      mockZitadelClient.addUser(userWithoutDisplayName);

      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');

      // Verify user was created with givenName + familyName
      const createUserCall = mockZulipClient.apiCalls[1];
      expect(createUserCall.args[0]).toEqual({
        email: 'newuser@example.com',
        full_name: 'John Doe',
      });
    });

    it('should fallback to userName when other names are unavailable', async () => {
      const userWithOnlyUserName = {
        ...testZitadelUser,
        displayName: '',
        givenName: '',
        familyName: '',
      };
      mockZitadelClient.addUser(userWithOnlyUserName);

      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');

      // Verify user was created with userName
      const createUserCall = mockZulipClient.apiCalls[1];
      expect(createUserCall.args[0]).toEqual({
        email: 'newuser@example.com',
        full_name: 'johndoe',
      });
    });
  });

  describe('welcome message', () => {
    it('should send welcome message with correct content and recipient', async () => {
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);

      const welcomeCall = mockZulipClient.apiCalls.find(call => call.method === 'sendPrivateMessage');
      expect(welcomeCall).toBeTruthy();
      if (welcomeCall) {
        expect(welcomeCall.args[0]).toBe('newuser@example.com');

        const messageContent = welcomeCall.args[1] as string;
        expect(messageContent.includes('Welcome to Rawkode Academy')).toBe(true);
        expect(messageContent.includes('#general')).toBe(true);
        expect(messageContent.includes('#help')).toBe(true);
        expect(messageContent.includes('account settings')).toBe(true);
      }
    });
  });

  describe('data integrity', () => {
    it('should store consistent mapping data', async () => {
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.data.status).toBe('success');

      const userMapping = await mockKV.get('user:zitadel-123');
      expect(userMapping).toBeTruthy();

      if (userMapping) {
        const mapping = JSON.parse(userMapping);
        expect(mapping.zitadelUserId).toBe(validRequest.zitadelUserId);
        expect(mapping.email).toBe('newuser@example.com');
        expect(mapping.zulipUserId).toBe(response.data.zulipUserId);
        expect(mapping.createdAt).toBeTruthy();
        expect(mapping.updatedAt).toBeTruthy();
        expect(new Date(mapping.createdAt)).toBeInstanceOf(Date);
        expect(new Date(mapping.updatedAt)).toBeInstanceOf(Date);
      }
    });

    it('should create bidirectional mappings', async () => {
      const mockContext = createTestContext(mockEnv, mockZulipClient, mockZitadelClient, validRequest);

      await provisionUser(mockContext);
      const response = mockContext._getLastResponse();

      expect(response.data.status).toBe('success');

      const userMapping = await mockKV.get('user:zitadel-123');
      const emailMapping = await mockKV.get('email:newuser@example.com');

      expect(userMapping).toBeTruthy();
      expect(emailMapping).toBe('zitadel-123');
    });
  });
});
