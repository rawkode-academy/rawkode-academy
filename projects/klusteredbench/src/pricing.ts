/**
 * USD per million tokens. Anthropic first-party API list prices.
 * Snapshot taken 2026-09; override per run with `pricing:` in bench.yaml
 * when these drift - the report records which table was used.
 */
export interface ModelPrice {
	input: number;
	output: number;
	cacheWrite: number;
	cacheRead: number;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheWriteTokens: number;
	cacheReadTokens: number;
}

const p = (input: number, output: number, cacheRead?: number): ModelPrice => ({
	input,
	output,
	cacheWrite: input * 1.25,
	cacheRead: cacheRead ?? input * 0.1,
});

export const DEFAULT_PRICING: Record<string, ModelPrice> = {
	"claude-fable-5-1": p(10, 50, 0.25),
	"claude-fable-5": p(10, 50),
	"claude-opus-5": p(5, 25),
	"claude-opus-4-8": p(5, 25),
	"claude-opus-4-7": p(5, 25),
	"claude-opus-4-6": p(5, 25),
	"claude-sonnet-5": p(2, 10),
	"claude-sonnet-4-6": p(3, 15),
	"claude-haiku-4-5": p(1, 5),
};

export const EMPTY_USAGE: TokenUsage = {
	inputTokens: 0,
	outputTokens: 0,
	cacheWriteTokens: 0,
	cacheReadTokens: 0,
};

export function addUsage(a: TokenUsage, b: Partial<TokenUsage>): TokenUsage {
	return {
		inputTokens: a.inputTokens + (b.inputTokens ?? 0),
		outputTokens: a.outputTokens + (b.outputTokens ?? 0),
		cacheWriteTokens: a.cacheWriteTokens + (b.cacheWriteTokens ?? 0),
		cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens ?? 0),
	};
}

export function totalTokens(u: TokenUsage): number {
	return (
		u.inputTokens + u.outputTokens + u.cacheWriteTokens + u.cacheReadTokens
	);
}

/** Returns null when the model has no known price rather than guessing. */
export function estimateCostUsd(
	model: string,
	usage: TokenUsage,
	pricing: Record<string, ModelPrice> = DEFAULT_PRICING,
): number | null {
	const price = pricing[model];
	if (!price) return null;
	const perToken = 1 / 1_000_000;
	return (
		usage.inputTokens * price.input * perToken +
		usage.outputTokens * price.output * perToken +
		usage.cacheWriteTokens * price.cacheWrite * perToken +
		usage.cacheReadTokens * price.cacheRead * perToken
	);
}
