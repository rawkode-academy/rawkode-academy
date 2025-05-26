import type { ZitadelUser } from "./types";

export interface ZitadelClientConfig {
	domain: string;
	apiToken: string;
}

interface ZitadelApiResponse {
	user: {
		userId: string;
		username: string;
		loginNames: string[];
		state: string;
		details: {
			changeDate: string;
		};
		human?: {
			profile?: {
				displayName?: string;
				nickName?: string;
				preferredLanguage?: string;
				gender?: string;
				givenName?: string;
				familyName?: string;
			};
			email?: {
				email: string;
				isVerified: boolean;
			};
			phone?: {
				phone?: string;
				isVerified?: boolean;
			};
		};
	};
}

export class ZitadelClient {
	private domain: string;
	private apiToken: string;

	constructor(config: ZitadelClientConfig) {
		this.domain = config.domain;
		this.apiToken = config.apiToken;
	}

	async getUserById(userId: string): Promise<ZitadelUser | null> {
		console.log(`Fetching user from Zitadel: ${userId}`);

		try {
			const response = await fetch(
				`https://${this.domain}/v2/users/${userId}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.apiToken}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(
					`Zitadel API error: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as ZitadelApiResponse;
			const rawUser = data.user;

			// Transform the nested API response to match our interface
			const transformedUser: ZitadelUser = {
				userId: rawUser.userId,
				userName: rawUser.username,
				loginNames: rawUser.loginNames || [],
				displayName: rawUser.human?.profile?.displayName || "",
				nickName: rawUser.human?.profile?.nickName || "",
				preferredLanguage: rawUser.human?.profile?.preferredLanguage || "",
				gender: rawUser.human?.profile?.gender || "",
				givenName: rawUser.human?.profile?.givenName || "",
				familyName: rawUser.human?.profile?.familyName || "",
				email: rawUser.human?.email?.email || "",
				isEmailVerified: rawUser.human?.email?.isVerified || false,
				phone: rawUser.human?.phone?.phone || "",
				isPhoneVerified: rawUser.human?.phone?.isVerified || false,
				state: rawUser.state || "",
				creationDate: rawUser.details?.changeDate || "",
				changeDate: rawUser.details?.changeDate || "",
			};

			return transformedUser;
		} catch (error) {
			console.error("Error fetching user from Zitadel:", error);
			throw error;
		}
	}
}
