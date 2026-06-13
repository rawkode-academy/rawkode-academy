// Constants
export const ROUND_COUNT = 10;
export const OPTION_COUNT = 4;
export const TIMER_SECONDS = 15;

// Types
export type CncfStatus = "graduated" | "incubating" | "sandbox" | "archived" | null;

export interface Logo {
	name: string;
	iconUrl: string;
	cncfStatus: CncfStatus;
}

export interface Round {
	logo: Logo;
	options: string[];
	answer: string;
}

// Seeded PRNG — mulberry32 style
export function createRng(seed: number): () => number {
	let s = seed >>> 0;
	return function () {
		s += 0x6d2b79f5;
		let z = s;
		z = Math.imul(z ^ (z >>> 15), z | 1);
		z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
		return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
	};
}

// Stable string hash for a YYYY-MM-DD date string
export function seedFromDate(date: string): number {
	let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
	for (let i = 0; i < date.length; i++) {
		hash ^= date.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

// Format a Date as YYYY-MM-DD in UTC
export function utcDateString(d: Date): string {
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// Pick n distinct distractors (names) from pool, all != answer
export function pickDistractors(
	answer: string,
	pool: Logo[],
	n: number,
	rng: () => number,
): string[] {
	const candidates = pool.map((l) => l.name).filter((name) => name !== answer);
	// Fisher-Yates shuffle on candidates
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = candidates[i] as string;
		candidates[i] = candidates[j] as string;
		candidates[j] = tmp;
	}
	return candidates.slice(0, n);
}

// Build rounds from a pool using the provided rng
export function buildRounds(
	pool: Logo[],
	count: number,
	optionCount: number,
	rng: () => number,
): Round[] {
	if (pool.length < count) {
		throw new Error(`Pool too small: need ${count}, have ${pool.length}`);
	}
	if (pool.length < optionCount) {
		throw new Error(`Pool too small for options: need ${optionCount}, have ${pool.length}`);
	}

	// Pick `count` distinct logos via partial Fisher-Yates
	const indices = pool.map((_, i) => i);
	for (let i = indices.length - 1; i > indices.length - 1 - count; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = indices[i] as number;
		indices[i] = indices[j] as number;
		indices[j] = tmp;
	}
	const chosen = indices.slice(indices.length - count).map((i) => pool[i] as Logo);

	return chosen.map((logo) => {
		const distractors = pickDistractors(logo.name, pool, optionCount - 1, rng);
		const options = [logo.name, ...distractors];
		// Shuffle options
		for (let i = options.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			const tmp = options[i] as string;
			options[i] = options[j] as string;
			options[j] = tmp;
		}
		return {
			logo,
			options,
			answer: logo.name,
		};
	});
}

// Build the daily puzzle deterministically from a date string
export function buildDailyRounds(
	pool: Logo[],
	date: string,
	count: number = ROUND_COUNT,
	optionCount: number = OPTION_COUNT,
): Round[] {
	// Sort pool by iconUrl then name for a stable ordering across deploys
	const sorted = [...pool].sort((a, b) => {
		if (a.iconUrl < b.iconUrl) return -1;
		if (a.iconUrl > b.iconUrl) return 1;
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		return 0;
	});
	const rng = createRng(seedFromDate(date));
	return buildRounds(sorted, count, optionCount, rng);
}

// Score a completed game
export function scoreGame(answers: (string | null)[], rounds: Round[]): number {
	let score = 0;
	for (let i = 0; i < rounds.length; i++) {
		const round = rounds[i];
		if (round && answers[i] !== null && answers[i] === round.answer) {
			score++;
		}
	}
	return score;
}
