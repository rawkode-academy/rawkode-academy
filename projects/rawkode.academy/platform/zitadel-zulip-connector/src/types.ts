import { z } from "zod";

export interface Env {
	USER_MAPPINGS: KVNamespace;

	ZITADEL_DOMAIN: string;
	ZITADEL_API_TOKEN: string;

	ZULIP_SITE: string;
	ZULIP_BOT_EMAIL: string;
	ZULIP_API_KEY: string;
}

export const ProvisionUserSchema = z.object({
	zitadelUserId: z.string(),
});

export const UpdateUserSchema = z.object({
	zitadelUserId: z.string(),
	email: z.string().email(),
	updates: z.object({
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		email: z.string().email().optional(),
		isActive: z.boolean().optional(),
	}),
});

export type ProvisionUserRequest = z.infer<typeof ProvisionUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;

export interface UserMapping {
	zitadelUserId: string;
	zulipUserId: number;
	email: string;
	createdAt: string;
	updatedAt: string;
}

export interface ZulipUser {
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
}

export interface ZitadelUser {
	userId: string;
	userName: string;
	loginNames: string[];
	displayName: string;
	nickName: string;
	preferredLanguage: string;
	gender: string;
	givenName: string;
	familyName: string;
	email: string;
	isEmailVerified: boolean;
	phone: string;
	isPhoneVerified: boolean;
	state: string;
	creationDate: string;
	changeDate: string;
}
