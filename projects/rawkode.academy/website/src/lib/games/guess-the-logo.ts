// Constants
export const ROUND_COUNT = 5;
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
	// Sort the pool by name for a stable ordering across deploys. `iconUrl` is a
	// build-hashed asset path that changes between builds, so sorting on it would
	// break the "same UTC day => identical puzzle" guarantee; the name is stable.
	const sorted = [...pool].sort((a, b) => {
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		return 0;
	});
	const rng = createRng(seedFromDate(date));
	return buildRounds(sorted, count, optionCount, rng);
}

// Fixed UTC epoch: Jan 1 2024 is a Monday
const WEEK_EPOCH_MS = Date.UTC(2024, 0, 1);

// Given a Date, return the Monday (UTC) of its ISO week as a YYYY-MM-DD string
export function weekKey(d: Date): string {
	const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	// ISO week Monday: shift Sunday (0) to 7 so Monday is "day 1" from Monday
	const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
	const monday = new Date(d.getTime() - (isoDay - 1) * 86400000);
	return utcDateString(monday);
}

// Given a Date, return the integer number of whole weeks since the epoch (Jan 1 2024)
export function weekIndex(d: Date): number {
	const monday = new Date(weekKey(d) + "T00:00:00Z");
	return Math.floor((monday.getTime() - WEEK_EPOCH_MS) / (7 * 86400000));
}

// Build the weekly puzzle deterministically from a date.
// Non-repeating across weeks: shuffles pool once with a fixed constant seed,
// then selects 5 logos at cycled indices for the given week.
export function buildWeeklyRounds(
	pool: Logo[],
	d: Date,
	count: number = ROUND_COUNT,
	optionCount: number = OPTION_COUNT,
): Round[] {
	if (pool.length < count) {
		throw new Error(`Pool too small: need ${count}, have ${pool.length}`);
	}
	if (pool.length < optionCount) {
		throw new Error(`Pool too small for options: need ${optionCount}, have ${pool.length}`);
	}

	// Stable sort by name, then Fisher-Yates shuffle with a FIXED constant seed
	// so the overall ordering never changes across builds/weeks
	const sorted = [...pool].sort((a, b) => {
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		return 0;
	});
	const fixedRng = createRng(0x6e1c0de5);
	for (let i = sorted.length - 1; i > 0; i--) {
		const j = Math.floor(fixedRng() * (i + 1));
		const tmp = sorted[i] as Logo;
		sorted[i] = sorted[j] as Logo;
		sorted[j] = tmp;
	}

	// Select logos for this week using cycled indices
	const W = weekIndex(d);
	const wk = weekKey(d);
	const chosen: Logo[] = [];
	for (let i = 0; i < count; i++) {
		const idx = (W * count + i) % sorted.length;
		chosen.push(sorted[idx] as Logo);
	}

	// Build rounds with per-(week, position) seeded options
	return chosen.map((logo, i) => {
		const rng = createRng(seedFromDate(wk) ^ (i + 1));
		const distractors = pickDistractors(logo.name, pool, optionCount - 1, rng);
		const options = [logo.name, ...distractors];
		// Shuffle options with same rng
		for (let oi = options.length - 1; oi > 0; oi--) {
			const j = Math.floor(rng() * (oi + 1));
			const tmp = options[oi] as string;
			options[oi] = options[j] as string;
			options[j] = tmp;
		}
		return {
			logo,
			options,
			answer: logo.name,
		};
	});
}

// Compute the point-based score for a completed game
// base=500 + speed bonus (up to 500) * streak multiplier (up to 1.5x)
export function computeScore(
	rounds: Round[],
	answers: (string | null)[],
	timeLeftMs: number[],
): number {
	let total = 0;
	let streak = 0;
	for (let i = 0; i < rounds.length; i++) {
		const round = rounds[i];
		const answer = answers[i];
		const tLeft = timeLeftMs[i] ?? 0;
		if (round && answer !== null && answer === round.answer) {
			streak++;
			const base = 500;
			const clamped = Math.max(0, Math.min(1, tLeft / (TIMER_SECONDS * 1000)));
			const speed = Math.round(500 * clamped);
			const mult = Math.min(1.5, 1 + 0.1 * (streak - 1));
			total += Math.round((base + speed) * mult);
		} else {
			streak = 0;
		}
	}
	return total;
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
