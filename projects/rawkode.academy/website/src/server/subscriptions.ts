import type { AstroGlobal } from "astro";

/**
 * Check if a user is subscribed to a Resend audience
 *
 * @param audienceId - The Resend audience ID to check
 * @param userEmail - Optional email address to check (from authenticated user)
 * @param session - Optional Astro session object (for anonymous users)
 * @returns Promise<boolean> - true if user is subscribed, false otherwise
 */
export async function isSubscribedToAudience(
	audienceId: string,
	userEmail?: string,
	session?: AstroGlobal["session"],
): Promise<boolean> {
	// The session is an email hint, not proof of a current subscription:
	// the reader may have unsubscribed since the flag was recorded.
	let email = userEmail;
	if (!email && session) {
		const signedUpCourses = (await session.get("signedUpCourses")) || {};
		email = signedUpCourses[audienceId];
	}

	// Check if authenticated user is already subscribed via Resend API
	if (email) {
		try {
			const { getSecret } = await import("astro:env/server");
			const { Resend } = await import("resend");
			const resendApiKey =
				getSecret("RESEND_API_KEY") || process.env.RESEND_API_KEY;

			if (resendApiKey) {
				const resend = new Resend(resendApiKey);
				try {
					const contact = await resend.contacts.get({
						email,
						audienceId: audienceId,
					});
					return !contact.error && contact.data?.unsubscribed === false;
				} catch (error) {
					// Contact not found or other error - they're not subscribed
					return false;
				}
			}
		} catch (error) {
			// Error checking subscription status
			return false;
		}
	}

	return false;
}
