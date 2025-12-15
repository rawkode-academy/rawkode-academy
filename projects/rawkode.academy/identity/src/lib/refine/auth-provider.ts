import type { AuthProvider } from "@refinedev/core";

interface User {
	id: string;
	name: string;
	email: string;
	image?: string;
}

interface Session {
	user: User;
}

export const authProvider: AuthProvider = {
	check: async () => {
		try {
			const response = await fetch("/auth/get-session", {
				credentials: "include",
			});

			if (response.ok) {
				const session: Session | null = await response.json();
				if (session?.user) {
					return { authenticated: true };
				}
			}

			return {
				authenticated: false,
				redirectTo: "/auth/sign-in/social?provider=github",
			};
		} catch {
			return {
				authenticated: false,
				redirectTo: "/auth/sign-in/social?provider=github",
			};
		}
	},

	getIdentity: async () => {
		try {
			const response = await fetch("/auth/get-session", {
				credentials: "include",
			});

			if (response.ok) {
				const session: Session | null = await response.json();
				return session?.user ?? null;
			}

			return null;
		} catch {
			return null;
		}
	},

	logout: async () => {
		try {
			await fetch("/auth/sign-out", {
				method: "POST",
				credentials: "include",
			});

			return {
				success: true,
				redirectTo: "/",
			};
		} catch {
			return {
				success: false,
				error: new Error("Logout failed"),
			};
		}
	},

	// Not used - we use GitHub OAuth flow
	login: async () => ({
		success: false,
		error: new Error("Use GitHub OAuth to sign in"),
	}),

	onError: async (error) => {
		if (error.status === 401 || error.status === 403) {
			return {
				logout: true,
				redirectTo: "/auth/sign-in/social?provider=github",
			};
		}

		return { error };
	},
};
