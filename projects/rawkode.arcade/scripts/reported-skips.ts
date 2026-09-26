/** Match reporter results, not words in legitimate regression-test names. */
export function reportsSkippedTests(transcript: string): boolean {
	return [
		/(?:^|\s)[1-9]\d*\s+(?:skipped|skip|pending|todo)\b/im,
		/^\s*\((?:skip|skipped|pending|todo)\)/im,
		/^\s*(?:ok|not ok)\s+\d+[^\n]*#\s*(?:SKIP|TODO)\b/im,
	].some((pattern) => pattern.test(transcript));
}
