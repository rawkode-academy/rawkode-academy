/**
 * Hardcoded list of admin email addresses.
 * Users with these emails can access the admin panel.
 */
export const ADMIN_EMAILS = ["david@rawkode.dev"];

/**
 * Check if an email address belongs to an admin user.
 */
export function isAdmin(email: string | null | undefined): boolean {
	if (!email) return false;
	return ADMIN_EMAILS.includes(email.toLowerCase());
}
