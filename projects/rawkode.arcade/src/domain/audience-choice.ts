export const MAX_AUDIENCE_BINS_PER_SHARD = 32;
// The public protocol accepts up to 100 characters. 128 bytes preserves the
// advertised maximum for ASCII answers while still giving the room row a hard
// storage ceiling for multibyte input.
export const MAX_AUDIENCE_CHOICE_BYTES = 128;
export const AUDIENCE_OTHER_BIN = "Other";

const bytes = (value: string): number => new TextEncoder().encode(value).byteLength;

/** Produces a bounded, display-safe key before it enters shard or room storage. */
export function normalizeAudienceChoice(value: string): string {
	const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/gu, " ").trim();
	let result = "";
	for (const character of normalized) {
		if (bytes(result + character) > MAX_AUDIENCE_CHOICE_BYTES) break;
		result += character;
	}
	return result;
}

/** Keeps useful named bins while coalescing adversarial high-cardinality input. */
export function boundedAudienceBin(existing: ReadonlySet<string>, value: string): string {
	const normalized = normalizeAudienceChoice(value);
	if (!normalized) return "";
	if (existing.has(normalized) || normalized === AUDIENCE_OTHER_BIN) return normalized;
	const namedBins = [...existing].filter((choice) => choice !== AUDIENCE_OTHER_BIN).length;
	return namedBins < MAX_AUDIENCE_BINS_PER_SHARD ? normalized : AUDIENCE_OTHER_BIN;
}

export function validAudienceTotals(value: Record<string, number> | undefined): boolean {
	if (!value) return true;
	const entries = Object.entries(value);
	if (entries.length > MAX_AUDIENCE_BINS_PER_SHARD + 1) return false;
	return entries.every(([choice, total]) => choice === normalizeAudienceChoice(choice) && choice.length > 0 && Number.isSafeInteger(total) && total >= 0);
}
