import type { APIContext } from "astro";
import { createAuth, type AuthEnv } from "./auth";
import { isAdmin } from "./admin-config";

interface AdminAuthResult {
	authorized: true;
	userId: string;
	email: string;
}

interface AdminAuthError {
	authorized: false;
	response: Response;
}

export type AdminAuthCheck = AdminAuthResult | AdminAuthError;

/**
 * Check if the current request is from an authorized admin user.
 * Returns the user info if authorized, or an error response if not.
 */
export async function checkAdminAuth(
	context: APIContext,
): Promise<AdminAuthCheck> {
	const env = context.locals.runtime.env as AuthEnv;
	const auth = await createAuth(env);

	const session = await auth.api.getSession({
		headers: context.request.headers,
	});

	if (!session?.user) {
		return {
			authorized: false,
			response: new Response("Unauthorized - Please sign in", { status: 401 }),
		};
	}

	if (!isAdmin(session.user.email)) {
		return {
			authorized: false,
			response: new Response("Forbidden - Admin access required", {
				status: 403,
			}),
		};
	}

	return {
		authorized: true,
		userId: session.user.id,
		email: session.user.email,
	};
}
