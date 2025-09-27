/**
 * Generate a shareable meeting URL
 */
export function generateMeetingUrl(
	meetingId: string,
	baseUrl?: string,
): string {
	const base =
		baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
	return `${base}/join/${meetingId}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		}
		return false;
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		return false;
	}
}
