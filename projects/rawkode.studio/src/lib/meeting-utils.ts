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
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			const result = document.execCommand("copy");
			textArea.remove();
			return result;
		}
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		return false;
	}
}
