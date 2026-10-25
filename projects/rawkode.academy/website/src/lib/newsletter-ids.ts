// Kept apart from src/actions/newsletter.ts so pages can build preference IDs
// without importing the action definitions (and, through `astro:actions`,
// Astro's route manifest) into their module graph.

/**
 * Helper to create a prefixed user ID for email preferences.
 * - For registered learners: `learner:{userId}`
 * - For email-only subscribers: `email:{email}`
 */
export function createLearnerId(userId: string): string {
	return `learner:${userId}`;
}

export function createEmailId(email: string): string {
	return `email:${email.toLowerCase().trim()}`;
}
