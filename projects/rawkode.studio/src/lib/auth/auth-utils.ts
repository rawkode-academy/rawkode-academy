import type { APIContext } from "astro";
import { hasDirectorRole } from "./auth-types";

/**
 * Checks if the authenticated user has director role and returns appropriate response
 * @param locals - Astro locals object containing user
 * @returns null if authorized, Response object if unauthorized
 */
export function requireDirectorRole(
	locals: APIContext["locals"],
): Response | null {
	// Check if user is authenticated
	if (!locals.user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	// Check if user has director role
	if (!hasDirectorRole(locals.user)) {
		return new Response(
			JSON.stringify({
				error: "Forbidden",
				message: "This operation requires director privileges",
			}),
			{
				status: 403,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	return null; // User is authorized
}

/**
 * Checks if the authenticated user has director role (boolean check only)
 * @param locals - Astro locals object containing user
 * @returns true if user has director role, false otherwise
 */
export function isDirector(locals: APIContext["locals"]): boolean {
	return locals.user ? hasDirectorRole(locals.user) : false;
}
