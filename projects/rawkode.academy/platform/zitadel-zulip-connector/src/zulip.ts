export class ZulipClient {
	private config: {
		site: string;
		email: string;
		apiKey: string;
	};

	constructor(config: {
		site: string;
		email: string;
		apiKey: string;
	}) {
		this.config = config;
	}

	private get authHeader() {
		return `Basic ${btoa(`${this.config.email}:${this.config.apiKey}`)}`;
	}

	private async request<T = unknown>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.config.site}/api/v1${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				Authorization: this.authHeader,
				"Content-Type": "application/x-www-form-urlencoded",
				...options.headers,
			},
		});

		const data = (await response.json()) as T;

		if (!response.ok) {
			throw new Error(
				(data as { msg?: string }).msg || `HTTP ${response.status}`,
			);
		}

		return data;
	}

	async getUserByEmail(email: string) {
		try {
			const result = await this.request<{
				user: {
					user_id: number;
					email: string;
					full_name: string;
					is_active: boolean;
					is_admin: boolean;
					is_owner: boolean;
					is_guest: boolean;
					is_bot: boolean;
					avatar_url: string;
					timezone: string;
					date_joined: string;
				};
			}>(`/users/${email}`);
			return result.user;
		} catch {
			return null;
		}
	}

	async getUserById(userId: number) {
		const result = await this.request<{ user: unknown }>(`/users/${userId}`);
		return result.user;
	}

	private generatePassphrase(): string {
		// Generate 2 UUIDs and combine them for a secure password
		const uuid1 = crypto.randomUUID();
		const uuid2 = crypto.randomUUID();
		return `${uuid1}-${uuid2}`;
	}

	async createUser(userData: {
		email: string;
		full_name: string;
	}) {
		try {
			const password = this.generatePassphrase();
			const formData = new URLSearchParams({
				...userData,
				password,
			});

			const result = await this.request<{ user_id: number }>("/users", {
				method: "POST",
				body: formData.toString(),
			});

			return { success: true, userId: result.user_id };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async updateUser(userId: number, updates: Record<string, unknown>) {
		const formData = new URLSearchParams();

		// Map updates to Zulip API format
		for (const [key, value] of Object.entries(updates)) {
			formData.append(key, String(value));
		}

		return this.request(`/users/${userId}`, {
			method: "PATCH",
			body: formData.toString(),
		});
	}

	async addSubscriptions(email: string, streams: string[]) {
		const formData = new URLSearchParams({
			subscriptions: JSON.stringify(
				streams.map((stream) => ({ name: stream })),
			),
			principals: JSON.stringify([email]),
		});

		return this.request("/users/me/subscriptions", {
			method: "POST",
			body: formData.toString(),
		});
	}

	async sendPrivateMessage(to: string, content: string) {
		const formData = new URLSearchParams({
			type: "private",
			to: JSON.stringify([to]),
			content,
		});

		return this.request("/messages", {
			method: "POST",
			body: formData.toString(),
		});
	}

	get site() {
		return this.config.site;
	}
}
