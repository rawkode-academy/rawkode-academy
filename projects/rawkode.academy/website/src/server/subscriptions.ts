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
	// Check session for anonymous users who have already signed up
	if (session) {
		const signedUpCourses = (await session.get("signedUpCourses")) || {};
		const sessionEmail = signedUpCourses[audienceId];

		if (sessionEmail && !userEmail) {
			// Anonymous user who already signed up in this session
			return true;
		}
	}

	// Check if authenticated user is already subscribed via Resend API
	if (userEmail) {
		try {
			const { getSecret } = await import("astro:env/server");
			const { Resend } = await import("resend");
			const resendApiKey =
				getSecret("RESEND_API_KEY") || process.env.RESEND_API_KEY;

			if (resendApiKey) {
				const resend = new Resend(resendApiKey);
				try {
					const contact = await resend.contacts.get({
						email: userEmail,
						audienceId: audienceId,
					});
					return contact.data !== null;
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
