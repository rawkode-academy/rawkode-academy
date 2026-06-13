import { describe, expect, it } from "vitest";
import {
	OPTION_COUNT,
	ROUND_COUNT,
	TIMER_SECONDS,
	type Logo,
	buildDailyRounds,
	buildRounds,
	buildWeeklyRounds,
	computeScore,
	createRng,
	pickDistractors,
	scoreGame,
	seedFromDate,
	utcDateString,
	weekIndex,
	weekKey,
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

// --- weekKey ---

describe("weekKey", () => {
	it("returns the Monday of the ISO week as YYYY-MM-DD", () => {
		// 2024-01-01 is a Monday
		expect(weekKey(new Date("2024-01-01T00:00:00Z"))).toBe("2024-01-01");
	});

	it("maps a Wednesday to the preceding Monday", () => {
		// 2024-01-03 is a Wednesday
		expect(weekKey(new Date("2024-01-03T12:00:00Z"))).toBe("2024-01-01");
	});

	it("maps a Sunday to the preceding Monday", () => {
		// 2024-01-07 is a Sunday
		expect(weekKey(new Date("2024-01-07T23:59:59Z"))).toBe("2024-01-01");
	});

	it("advances to the next Monday at week boundary", () => {
		// 2024-01-08 is the next Monday
		expect(weekKey(new Date("2024-01-08T00:00:00Z"))).toBe("2024-01-08");
	});
});

// --- weekIndex ---

describe("weekIndex", () => {
	it("returns 0 for the epoch Monday (2024-01-01)", () => {
		expect(weekIndex(new Date("2024-01-01T00:00:00Z"))).toBe(0);
	});

	it("returns 0 for any day in the same week as the epoch", () => {
		expect(weekIndex(new Date("2024-01-03T12:00:00Z"))).toBe(0);
		expect(weekIndex(new Date("2024-01-07T23:59:59Z"))).toBe(0);
	});

	it("returns 1 for the week starting 2024-01-08", () => {
		expect(weekIndex(new Date("2024-01-08T00:00:00Z"))).toBe(1);
		expect(weekIndex(new Date("2024-01-10T12:00:00Z"))).toBe(1);
	});

	it("is non-decreasing across consecutive weeks", () => {
		const w1 = weekIndex(new Date("2026-06-08T00:00:00Z"));
		const w2 = weekIndex(new Date("2026-06-15T00:00:00Z"));
		expect(w2).toBe(w1 + 1);
	});
});

// --- buildWeeklyRounds ---

const POOL_15 = makePool(15);

describe("buildWeeklyRounds", () => {
	it("is deterministic: same Date (same ISO week) yields identical rounds", () => {
		// Monday and Wednesday of the same week should produce the same puzzle
		const monday = new Date("2026-06-08T00:00:00Z");
		const wednesday = new Date("2026-06-10T14:00:00Z");
		const r1 = buildWeeklyRounds(POOL_15, monday);
		const r2 = buildWeeklyRounds(POOL_15, wednesday);
		expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
	});

	it("non-repetition: logos for two consecutive weeks are disjoint (pool > 10)", () => {
		const week1 = new Date("2026-06-08T00:00:00Z"); // ISO week 24
		const week2 = new Date("2026-06-15T00:00:00Z"); // ISO week 25
		const r1 = buildWeeklyRounds(POOL_15, week1);
		const r2 = buildWeeklyRounds(POOL_15, week2);
		const names1 = new Set(r1.map((r) => r.logo.name));
		const names2 = new Set(r2.map((r) => r.logo.name));
		// No overlap between the two weeks
		for (const name of names2) {
			expect(names1.has(name)).toBe(false);
		}
	});

	it("returns ROUND_COUNT rounds by default", () => {
		const rounds = buildWeeklyRounds(POOL_15, new Date("2026-06-08T00:00:00Z"));
		expect(rounds).toHaveLength(ROUND_COUNT);
	});

	it("each round options length === OPTION_COUNT", () => {
		const rounds = buildWeeklyRounds(POOL_15, new Date("2026-06-08T00:00:00Z"));
		for (const round of rounds) {
			expect(round.options).toHaveLength(OPTION_COUNT);
		}
	});

	it("each round options includes the answer", () => {
		const rounds = buildWeeklyRounds(POOL_15, new Date("2026-06-08T00:00:00Z"));
		for (const round of rounds) {
			expect(round.options).toContain(round.answer);
		}
	});

	it("different weeks yield different puzzles", () => {
		const r1 = buildWeeklyRounds(POOL_15, new Date("2026-06-08T00:00:00Z"));
		const r2 = buildWeeklyRounds(POOL_15, new Date("2026-06-15T00:00:00Z"));
		expect(JSON.stringify(r1)).not.toBe(JSON.stringify(r2));
	});
});

// --- computeScore ---

describe("computeScore", () => {
	const rng = createRng(77);
	const rounds = buildRounds(POOL_20, ROUND_COUNT, OPTION_COUNT, rng);

	it("all-correct-instant hits the streak-scaled maximum (~6000)", () => {
		const answers = rounds.map((r) => r.answer);
		const timeLeftMs = rounds.map(() => TIMER_SECONDS * 1000);
		const score = computeScore(rounds, answers, timeLeftMs);
		// Each round: (500 + 500) * mult. Streak 1..5 => mult 1.0,1.1,1.2,1.3,1.4
		// => 1000*1 + 1000*1.1 + 1000*1.2 + 1000*1.3 + 1000*1.4 = 6000
		expect(score).toBe(6000);
	});

	it("a wrong answer scores 0 contribution and resets streak", () => {
		// round 0 wrong, round 1 correct instant, round 2 correct instant
		const answers: (string | null)[] = rounds.map((r, i) => {
			if (i === 0) return r.options.find((o) => o !== r.answer) ?? null;
			return r.answer;
		});
		const timeLeftMs = rounds.map(() => TIMER_SECONDS * 1000);
		const score = computeScore(rounds, answers, timeLeftMs);
		// After wrong at 0, streak resets. Rounds 1-4 correct with streak 1,2,3,4
		// => 1000*1.0 + 1000*1.1 + 1000*1.2 + 1000*1.3 = 4600
		expect(score).toBe(4600);
	});

	it("slow-but-correct still earns the 500 base regardless of speed", () => {
		// All correct, but zero time left (timeout edge)
		const answers = rounds.map((r) => r.answer);
		const timeLeftMs = rounds.map(() => 0);
		const score = computeScore(rounds, answers, timeLeftMs);
		// Each round: (500 + 0) * streak mult
		// streak 1..5 => 500*1.0 + 500*1.1 + 500*1.2 + 500*1.3 + 500*1.4 = 3000
		expect(score).toBe(3000);
	});

	it("timeLeftMs is clamped to [0, TIMER_SECONDS*1000]", () => {
		// Negative timeLeftMs should be treated as 0 (no bonus)
		const answers = [rounds[0]?.answer ?? null];
		const negativeTime = [-5000];
		const singleRound = rounds.slice(0, 1);
		const scoreNeg = computeScore(singleRound, answers, negativeTime);
		// Should equal base only: 500 * 1 = 500
		expect(scoreNeg).toBe(500);

		// Over-limit timeLeftMs should be clamped to max (full speed bonus)
		const overTime = [TIMER_SECONDS * 1000 * 2];
		const scoreOver = computeScore(singleRound, answers, overTime);
		// Should equal (500+500)*1 = 1000
		expect(scoreOver).toBe(1000);
	});

	it("all wrong/null yields 0", () => {
		const answers: (string | null)[] = rounds.map(() => null);
		const timeLeftMs = rounds.map(() => 0);
		expect(computeScore(rounds, answers, timeLeftMs)).toBe(0);
	});
});
