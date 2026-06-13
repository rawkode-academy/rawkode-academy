import { describe, expect, it } from "vitest";
import {
	OPTION_COUNT,
	ROUND_COUNT,
	type Logo,
	buildDailyRounds,
	buildRounds,
	createRng,
	pickDistractors,
	scoreGame,
	seedFromDate,
	utcDateString,
} from "./guess-the-logo";

// --- Helpers ---

function makePool(n: number): Logo[] {
	return Array.from({ length: n }, (_, i) => ({
		name: `Tech-${i}`,
		iconUrl: `https://example.com/tech-${i}.svg`,
		cncfStatus: null,
	}));
}

const POOL_20 = makePool(20);

// --- utcDateString ---

describe("utcDateString", () => {
	it("formats a UTC date as YYYY-MM-DD regardless of local timezone", () => {
		// 2024-03-15 in UTC, even if the local clock is behind UTC midnight
		const d = new Date("2024-03-15T00:30:00Z");
		expect(utcDateString(d)).toBe("2024-03-15");
	});

	it("zero-pads month and day", () => {
		const d = new Date("2026-01-05T12:00:00Z");
		expect(utcDateString(d)).toBe("2026-01-05");
	});
});

// --- seedFromDate ---

describe("seedFromDate", () => {
	it("returns a non-negative integer", () => {
		const seed = seedFromDate("2026-06-13");
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(seed)).toBe(true);
	});

	it("is stable for the same input", () => {
		expect(seedFromDate("2026-06-13")).toBe(seedFromDate("2026-06-13"));
	});

	it("differs for different dates", () => {
		expect(seedFromDate("2026-06-13")).not.toBe(seedFromDate("2026-06-14"));
	});
});

// --- createRng ---

describe("createRng", () => {
	it("returns values in [0, 1)", () => {
		const rng = createRng(42);
		for (let i = 0; i < 100; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it("is deterministic for the same seed", () => {
		const rng1 = createRng(12345);
		const rng2 = createRng(12345);
		for (let i = 0; i < 20; i++) {
			expect(rng1()).toBe(rng2());
		}
	});

	it("differs for different seeds", () => {
		const a = createRng(1)();
		const b = createRng(2)();
		expect(a).not.toBe(b);
	});
});

// --- pickDistractors ---

describe("pickDistractors", () => {
	it("returns n distinct names", () => {
		const rng = createRng(1);
		const distractors = pickDistractors("Tech-0", POOL_20, 3, rng);
		expect(distractors).toHaveLength(3);
		expect(new Set(distractors).size).toBe(3);
	});

	it("never includes the answer", () => {
		const rng = createRng(2);
		const distractors = pickDistractors("Tech-5", POOL_20, 3, rng);
		expect(distractors).not.toContain("Tech-5");
	});

	it("all names come from the pool", () => {
		const poolNames = new Set(POOL_20.map((l) => l.name));
		const rng = createRng(3);
		const distractors = pickDistractors("Tech-3", POOL_20, 5, rng);
		for (const d of distractors) {
			expect(poolNames.has(d)).toBe(true);
		}
	});
});

// --- buildRounds ---

describe("buildRounds", () => {
	it("returns exactly count rounds", () => {
		const rng = createRng(99);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		expect(rounds).toHaveLength(ROUND_COUNT);
	});

	it("each round has exactly OPTION_COUNT options", () => {
		const rng = createRng(99);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		for (const round of rounds) {
			expect(round.options).toHaveLength(OPTION_COUNT);
		}
	});

	it("answer is always among options", () => {
		const rng = createRng(42);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		for (const round of rounds) {
			expect(round.options).toContain(round.answer);
		}
	});

	it("answer matches the logo name", () => {
		const rng = createRng(7);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		for (const round of rounds) {
			expect(round.answer).toBe(round.logo.name);
		}
	});

	it("options are distinct within each round", () => {
		const rng = createRng(55);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		for (const round of rounds) {
			expect(new Set(round.options).size).toBe(OPTION_COUNT);
		}
	});

	it("all options come from the pool", () => {
		const poolNames = new Set(POOL_20.map((l) => l.name));
		const rng = createRng(22);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		for (const round of rounds) {
			for (const opt of round.options) {
				expect(poolNames.has(opt)).toBe(true);
			}
		}
	});

	it("logos are distinct across rounds", () => {
		const rng = createRng(11);
		const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);
		const logoNames = rounds.map((r) => r.logo.name);
		expect(new Set(logoNames).size).toBe(ROUND_COUNT);
	});

	it("throws when pool is too small", () => {
		const rng = createRng(1);
		expect(() => buildRounds(makePool(3), ROUND_COUNT, OPTION_COUNT, rng)).toThrow();
	});
});

// --- buildDailyRounds ---

describe("buildDailyRounds", () => {
	it("is deterministic: same date yields identical rounds", () => {
		const rounds1 = buildDailyRounds(POOL_20, "2026-06-13");
		const rounds2 = buildDailyRounds(POOL_20, "2026-06-13");
		expect(JSON.stringify(rounds1)).toBe(JSON.stringify(rounds2));
	});

	it("same date with same pool in different order yields identical rounds", () => {
		const shuffled = [...POOL_20].reverse();
		const rounds1 = buildDailyRounds(POOL_20, "2026-06-14");
		const rounds2 = buildDailyRounds(shuffled, "2026-06-14");
		expect(JSON.stringify(rounds1)).toBe(JSON.stringify(rounds2));
	});

	it("different dates yield different rounds", () => {
		const rounds1 = buildDailyRounds(POOL_20, "2026-06-13");
		const rounds2 = buildDailyRounds(POOL_20, "2026-06-14");
		// At least one round should differ (statistically near-certain with 20-logo pool)
		expect(JSON.stringify(rounds1)).not.toBe(JSON.stringify(rounds2));
	});

	it("returns ROUND_COUNT rounds by default", () => {
		const rounds = buildDailyRounds(POOL_20, "2026-06-13");
		expect(rounds).toHaveLength(ROUND_COUNT);
	});

	it("respects custom count and optionCount", () => {
		const rounds = buildDailyRounds(POOL_20, "2026-06-13", 5, 3);
		expect(rounds).toHaveLength(5);
		for (const round of rounds) {
			expect(round.options).toHaveLength(3);
		}
	});
});

// --- scoreGame ---

describe("scoreGame", () => {
	const rng = createRng(1);
	const rounds = buildRounds(POOL_20, 5, OPTION_COUNT, rng);

	it("counts all correct answers", () => {
		const answers = rounds.map((r) => r.answer);
		expect(scoreGame(answers, rounds)).toBe(5);
	});

	it("counts all wrong answers as 0", () => {
		// Pick wrong answers by using the first non-answer option
		const answers = rounds.map((r) => r.options.find((o) => o !== r.answer) ?? null);
		expect(scoreGame(answers, rounds)).toBe(0);
	});

	it("treats null (timeout) as wrong", () => {
		const answers: (string | null)[] = rounds.map(() => null);
		expect(scoreGame(answers, rounds)).toBe(0);
	});

	it("counts mixed answers correctly", () => {
		const answers: (string | null)[] = rounds.map((r, i) => {
			if (i % 2 === 0) return r.answer; // correct on even indices
			if (i === 1) return null; // timeout
			return r.options.find((o) => o !== r.answer) ?? null; // wrong on odd
		});
		// indices 0,2,4 correct => 3 out of 5
		expect(scoreGame(answers, rounds)).toBe(3);
	});
});
