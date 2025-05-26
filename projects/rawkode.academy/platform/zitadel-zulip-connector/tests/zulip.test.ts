import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ZulipClient } from '../src/zulip';

// Mock fetch globally
const originalFetch = globalThis.fetch;
let mockResponses: Array<{ data: unknown; status: number; ok: boolean }> = [];
let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

function createMockResponse(data: unknown, status = 200, ok = true) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetch(url: string, options?: RequestInit): Promise<Response> {
  fetchCalls.push({ url, options: options || {} });

  if (mockResponses.length > 0) {
    const response = mockResponses.shift()!;
    return createMockResponse(response.data, response.status, response.ok);
  }

  return createMockResponse({});
}

function setMockResponse(data: unknown, status = 200, ok = true) {
  mockResponses.push({ data, status, ok });
}

describe('ZulipClient', () => {
  let zulipClient: ZulipClient;
  const config = {
    site: 'https://test.zulipchat.com',
    email: 'bot@test.com',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    zulipClient = new ZulipClient(config);
    fetchCalls = [];
    mockResponses = [];
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('constructor and basic properties', () => {
    it('should initialize with correct config', () => {
      expect(zulipClient.site).toBe('https://test.zulipchat.com');
    });

    it('should generate correct auth header', () => {
      // Access private method for testing
      const authHeader = (zulipClient as never).authHeader;
      const expectedAuth = btoa('bot@test.com:test-api-key');
      expect(authHeader).toBe(`Basic ${expectedAuth}`);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        user_id: 123,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_admin: false,
        is_owner: false,
        is_guest: false,
        is_bot: false,
        avatar_url: 'https://example.com/avatar.png',
        timezone: 'UTC',
        date_joined: '2024-01-01T00:00:00.000Z',
      };

      setMockResponse({ user: mockUser });

      const result = await zulipClient.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/users/test@example.com');
      expect(fetchCalls[0].options.headers).toBeTruthy();
    });

    it('should return null when user not found', async () => {
      setMockResponse({ msg: 'No such user' }, 404, false);

      const result = await zulipClient.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user data when found', async () => {
      const mockUser = { user_id: 123, email: 'test@example.com' };
      setMockResponse({ user: mockUser });

      const result = await zulipClient.getUserById(123);

      expect(result).toEqual(mockUser);
      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/users/123');
    });
  });

  describe('createUser', () => {
    it('should successfully create a user', async () => {
      const userData = {
        email: 'newuser@example.com',
        full_name: 'New User',
      };

      setMockResponse({ user_id: 456 });

      const result = await zulipClient.createUser(userData);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(456);

      // Verify the request was made correctly
      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/users');
      expect(fetchCalls[0].options.method).toBe('POST');

      const body = fetchCalls[0].options.body as string;
      expect(body).toContain('email=newuser%40example.com');
      expect(body).toContain('password=');
    });

    it('should handle user creation failure', async () => {
      const userData = {
        email: 'invalid@example.com',
        full_name: 'Invalid User',
      };

      setMockResponse({ msg: 'Invalid email' }, 400, false);

      const result = await zulipClient.createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });
  });

  describe('updateUser', () => {
    it('should successfully update a user', async () => {
      const updates = { full_name: 'Updated Name', is_active: false };
      setMockResponse({});

      await zulipClient.updateUser(123, updates);

      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/users/123');
      expect(fetchCalls[0].options.method).toBe('PATCH');

      const body = fetchCalls[0].options.body as string;
      expect(body).toContain('full_name=Updated+Name');
    });
  });

  describe('addSubscriptions', () => {
    it('should add user to streams', async () => {
      const streams = ['general', 'development'];
      setMockResponse({});

      await zulipClient.addSubscriptions('test@example.com', streams);

      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/users/me/subscriptions');
      expect(fetchCalls[0].options.method).toBe('POST');

      const body = fetchCalls[0].options.body as string;
      expect(body).toContain('subscriptions=');
      expect(body).toContain('principals=');
    });
  });

  describe('sendPrivateMessage', () => {
    it('should send a private message', async () => {
      setMockResponse({});

      await zulipClient.sendPrivateMessage('recipient@example.com', 'Hello, world!');

      expect(fetchCalls[0].url).toBe('https://test.zulipchat.com/api/v1/messages');
      expect(fetchCalls[0].options.method).toBe('POST');

      const body = fetchCalls[0].options.body as string;
      expect(body).toContain('type=private');
      expect(body).toContain('content=Hello%2C+world%21');
      expect(body).toContain('to=');
    });
  });

  describe('error handling', () => {
    it('should throw error for failed requests', async () => {
      setMockResponse({ msg: 'Server error' }, 500, false);

      await expect(zulipClient.getUserById(123)).rejects.toThrow('Server error');
    });

    it('should throw error with status code when no message provided', async () => {
      setMockResponse({}, 404, false);

      await expect(zulipClient.getUserById(123)).rejects.toThrow('HTTP 404');
    });
  });

  describe('password generation', () => {
    it('should generate secure passwords', () => {
      const client = new ZulipClient(config);
      const password1 = (client as never).generatePassphrase();
      const password2 = (client as never).generatePassphrase();

      expect(password1).toBeTruthy();
      expect(password2).toBeTruthy();
      expect(password1).not.toBe(password2);
      expect(password1.length).toBeGreaterThan(70); // Two UUIDs + hyphen
    });
  });
});
