const TIMESTAMP_LINE = /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;

function timestamps(vtt: string): string[] {
	return vtt
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => TIMESTAMP_LINE.test(line));
}

/**
 * The review model is told to return only the corrected chunk, but small models
 * wrap it in code fences, prepend "Corrected WebVTT chunk:", or repeat the
 * chunk. Keep its output only when, after stripping that wrapping, it has
 * exactly the cue timings of the original; otherwise keep the original chunk.
 */
export function acceptReviewedChunk(original: string, response: unknown): string {
	if (typeof response !== "string") return original;

	const cleaned = response
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			return !trimmed.startsWith("```") && !/^corrected\b.*:$/i.test(trimmed);
		})
		.join("\n");

	const expected = timestamps(original);
	const actual = timestamps(cleaned);
	if (
		expected.length === 0 ||
		expected.length !== actual.length ||
		expected.some((stamp, index) => stamp !== actual[index])
	) {
		return original;
	}

	// A WEBVTT header inside the chunk (repeated chunk, preamble) would end up
	// as stray text in the stitched file.
	const body = cleaned
		.split("\n")
		.filter((line, index) => index === 0 || !line.startsWith("WEBVTT"))
		.join("\n");
	return body;
}
