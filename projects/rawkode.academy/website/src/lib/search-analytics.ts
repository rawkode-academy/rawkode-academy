const SEARCH_ACTION_PLACEHOLDER = "{search_term_string}";

export function shouldCaptureSearchAnalytics(query: string): boolean {
	const normalized = query.trim().toLowerCase();
	return normalized.length > 0 && normalized !== SEARCH_ACTION_PLACEHOLDER;
}
