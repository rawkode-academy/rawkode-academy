import type { Env, UserMapping, ZulipUser, ZitadelUser } from '../../src/types';

export class MockKVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<{ keys: { name: string }[] }> {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) };
  }

  async getWithMetadata(key: string): Promise<{ value: string | null; metadata: null }> {
    return { value: this.store.get(key) || null, metadata: null };
  }

  async putWithMetadata(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  getItem(key: string) {
    return this.store.get(key) || null;
  }
}

export class MockZulipClient {
  readonly site = 'https://test.zulipchat.com';
  private users = new Map<string, ZulipUser>();
  private userCounter = 1000;
  readonly apiCalls: Array<{ method: string; args: unknown[] }> = [];

  constructor(config?: { site?: string; email?: string; apiKey?: string }) {
    // Reset for each test
    this.users.clear();
    this.userCounter = 1000;
    this.apiCalls.length = 0;
  }

  async getUserByEmail(email: string): Promise<ZulipUser | null> {
    this.apiCalls.push({ method: 'getUserByEmail', args: [email] });
    return this.users.get(email) || null;
  }

  async getUserById(userId: number): Promise<ZulipUser | null> {
    this.apiCalls.push({ method: 'getUserById', args: [userId] });
    for (const user of this.users.values()) {
      if (user.user_id === userId) {
        return user;
      }
    }
    return null;
  }

  async createUser(userData: { email: string; full_name: string }): Promise<{ success: true; userId: number } | { success: false; error: string }> {
    this.apiCalls.push({ method: 'createUser', args: [userData] });

    if (this.users.has(userData.email)) {
      return { success: false, error: 'User already exists' };
    }

    const userId = ++this.userCounter;
    const user: ZulipUser = {
      user_id: userId,
      email: userData.email,
      full_name: userData.full_name,
      is_active: true,
      is_admin: false,
      is_owner: false,
      is_guest: false,
      is_bot: false,
      avatar_url: '',
      timezone: 'UTC',
      date_joined: new Date().toISOString(),
    };

    this.users.set(userData.email, user);
    return { success: true, userId };
  }

  async updateUser(userId: number, updates: Record<string, unknown>): Promise<void> {
    this.apiCalls.push({ method: 'updateUser', args: [userId, updates] });

    for (const [email, user] of this.users.entries()) {
      if (user.user_id === userId) {
        const updatedUser = { ...user, ...updates };
        this.users.delete(email);
        this.users.set(updatedUser.email, updatedUser as ZulipUser);
        break;
      }
    }
  }

  async addSubscriptions(email: string, streams: string[]): Promise<void> {
    this.apiCalls.push({ method: 'addSubscriptions', args: [email, streams] });
  }

  async sendPrivateMessage(to: string, content: string): Promise<void> {
    this.apiCalls.push({ method: 'sendPrivateMessage', args: [to, content] });
  }

  // Helper methods for testing
  addUser(user: ZulipUser) {
    this.users.set(user.email, user);
  }

  simulateCreateUserFailure(shouldFail = true) {
    const originalCreateUser = this.createUser.bind(this);
    if (shouldFail) {
      this.createUser = async () => ({ success: false, error: 'Simulated failure' });
    } else {
      this.createUser = originalCreateUser;
    }
  }
}

export class MockZitadelClient {
  private users = new Map<string, ZitadelUser>();
  readonly apiCalls: Array<{ method: string; args: unknown[] }> = [];

  constructor(config?: { domain?: string; apiToken?: string }) {
    // Reset for each test
    this.users.clear();
    this.apiCalls.length = 0;
  }

  async getUserById(userId: string): Promise<ZitadelUser | null> {
    this.apiCalls.push({ method: 'getUserById', args: [userId] });
    return this.users.get(userId) || null;
  }

  // Helper methods for testing
  addUser(user: ZitadelUser) {
    this.users.set(user.userId, user);
  }

  simulateGetUserFailure(shouldFail = true) {
    const originalGetUserById = this.getUserById.bind(this);
    if (shouldFail) {
      this.getUserById = async (userId: string) => {
        this.apiCalls.push({ method: 'getUserById', args: [userId] });
        return null;
      };
    } else {
      this.getUserById = originalGetUserById;
    }
  }
}

export function createMockEnv(): Env {
  return {
    ZULIP_SITE: 'https://test.zulipchat.com',
    ZULIP_BOT_EMAIL: 'bot@test.com',
    ZULIP_API_KEY: 'test-api-key',
    SERVICE_TOKEN: 'test-service-token',
    DEFAULT_STREAMS: 'general,announcements',
    USER_MAPPINGS: new MockKVNamespace() as unknown as KVNamespace,
    ZITADEL_DOMAIN: 'test.zitadel.cloud',
    ZITADEL_API_TOKEN: 'test-zitadel-token',
  };
}

export function createMockContext(env: Env, zulipClient: MockZulipClient) {
  return {
    env,
    get: (key: string) => {
      if (key === 'zulipClient') return zulipClient;
      return undefined;
    },
    set: () => {},
    req: {
      json: async () => ({}),
    },
    json: (data: unknown, status?: number) => ({
      data,
      status: status || 200,
    }),
  } as never;
}

export const testUserMapping: UserMapping = {
  zitadelUserId: 'zitadel-123',
  zulipUserId: 1001,
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const testZulipUser: ZulipUser = {
  user_id: 1001,
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

export const testZitadelUser: ZitadelUser = {
  userId: 'zitadel-123',
  userName: 'johndoe',
  loginNames: ['johndoe', 'john.doe@example.com'],
  displayName: 'John Doe',
  nickName: 'Johnny',
  preferredLanguage: 'en',
  gender: '',
  givenName: 'John',
  familyName: 'Doe',
  email: 'newuser@example.com',
  isEmailVerified: true,
  phone: '',
  isPhoneVerified: false,
  state: 'ACTIVE',
  creationDate: '2024-01-01T00:00:00.000Z',
  changeDate: '2024-01-01T00:00:00.000Z',
};
