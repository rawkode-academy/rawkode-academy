/**
 * Better Auth client wrapper for Rawkode Academy website
 *
 * This module provides a configured Better Auth client that routes requests
 * through the AUTH_SERVICE service binding to the authentication platform.
 */

import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "better-auth/client/plugins";

// TypeScript Interfaces based on platform/authentication/data-model/schema.ts

/**
 * Better Auth user entity
 */
export interface BetterAuthUser {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Better Auth session entity
 */
export interface BetterAuthSession {
	id: string;
	userId: string;
	expiresAt: Date;
	ipAddress: string | null;
	userAgent: string | null;
}

/**
 * Better Auth passkey entity
 */
export interface BetterAuthPasskey {
	id: string;
	name: string | null;
	publicKey: string;
	userId: string;
	credentialID: string;
	counter: number;
	deviceType: string;
	backedUp: boolean;
	transports: string | null;
	createdAt: Date;
	aaguid: string | null;
}

/**
 * Better Auth OAuth account entity
 */
export interface BetterAuthAccount {
	id: string;
	accountId: string;
	providerId: string;
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	accessTokenExpiresAt: Date | null;
	refreshTokenExpiresAt: Date | null;
	scope: string | null;
	password: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Creates a Better Auth client configured to communicate with the authentication
 * platform via the AUTH_SERVICE service binding.
 *
 * @param authService - The AUTH_SERVICE service binding (or compatible) from the Cloudflare runtime environment
 * @param options - Optional configuration such as per-request header injection
 * @returns Configured Better Auth client instance with passkey and GitHub OAuth support
 *
 * @example
 * ```ts
 * const authClient = createBetterAuthClient(runtime.env.AUTH_SERVICE);
 *
 * // Sign in with passkey
 * await authClient.signIn.passkey();
 *
 * // Register a new passkey
 * await authClient.addPasskey();
 *
 * // Sign in with GitHub OAuth
 * await authClient.signIn.social({ provider: "github" });
 *
 * // List user's passkeys
 * const passkeys = await authClient.listUserPasskeys();
 *
 * // Delete a passkey
 * await authClient.deletePasskey({ passkeyId: "passkey-id" });
 *
 * // Update passkey name
 * await authClient.updatePasskey({ passkeyId: "passkey-id", name: "My Device" });
 * ```
 */
type ServiceBindingLike = {
	fetch(request: Request): Promise<Response>;
};

type HeaderProvider = () =>
	| HeadersInit
	| undefined
	| Promise<HeadersInit | undefined>;

export interface BetterAuthClientOptions {
	getHeaders?: HeaderProvider;
}

export function createBetterAuthClient(
	authService: ServiceBindingLike,
	options?: BetterAuthClientOptions,
) {
	return createAuthClient({
		// Use a placeholder base URL - actual routing happens via service binding
		baseURL: "https://auth.internal",

		// Enable passkey authentication plugin
		plugins: [passkeyClient()],

		// Custom fetch implementation that routes through AUTH_SERVICE service binding
		fetchOptions: {
			customFetchImpl: async (url, init) => {
				// Extract the pathname + search from the Better Auth request URL
				const urlObj = new URL(url);
				const pathWithSearch = `${urlObj.pathname}${urlObj.search}`;
				const proxiedUrl = new URL(pathWithSearch, "https://auth.internal");

				const extraHeaders = options?.getHeaders
					? await options.getHeaders()
					: undefined;
				const mergedHeaders = new Headers(init?.headers);
				if (extraHeaders) {
					for (const [key, value] of new Headers(extraHeaders).entries()) {
						mergedHeaders.set(key, value);
					}
				}

				const requestInit: RequestInit = {
					...(init ?? {}),
					headers: mergedHeaders,
				};

				const request = new Request(proxiedUrl, requestInit);

				return authService.fetch(request);
			},
		},
	});
}

/**
 * Type alias for the Better Auth client instance
 * Use this for type inference in components and utilities
 */
export type BetterAuthClient = ReturnType<typeof createBetterAuthClient>;
