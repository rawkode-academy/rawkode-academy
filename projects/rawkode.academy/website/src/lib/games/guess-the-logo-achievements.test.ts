import { describe, expect, it } from "vitest";
import {
	ACHIEVEMENTS,
	NAMESPACE,
	type PlayerStats,
	evaluateAchievements,
} from "./guess-the-logo-achievements";

// --- Helpers ---

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
	return {
		weeksPlayed: 0,
		lastWeekKey: "",
		lastWeekIndex: 0,
		currentStreak: 0,
		longestStreak: 0,
		lifetimeCorrect: 0,
		perCategoryCorrect: {
			sandbox: 0,
			incubating: 0,
			graduated: 0,
			archived: 0,
			nonCncf: 0,
		},
		bestScore: 0,
		perfectWeeks: 0,
		correctLogos: [],
		wins: 0,
		podiums: 0,
		bestRank: 0,
		lastCreditedWeek: "",
		...overrides,
	};
}

const noFeat = { perfect: false, fastWeek: false };
const perfectFeat = { perfect: true, fastWeek: false };
const fastFeat = { perfect: false, fastWeek: true };
const bothFeats = { perfect: true, fastWeek: true };

const POOL = 100;

// --- NAMESPACE ---

describe("NAMESPACE", () => {
	it("is cnicon", () => {
		expect(NAMESPACE).toBe("cnicon");
	});
});

// --- ACHIEVEMENTS list ---

describe("ACHIEVEMENTS", () => {
	it("contains all 21 definitions", () => {
		expect(ACHIEVEMENTS).toHaveLength(21);
	});

	it("has every expected id", () => {
		const ids = ACHIEVEMENTS.map((a) => a.id);
		const expected = [
			"first-timer",
			"committed",
			"veteran",
			"regular",
			"devotee",
			"year-round",
			"century",
			"polyglot",
			"sandbox-sensei",
			"incubator",
			"honor-roll",
			"off-the-map",
			"podium",
			"champion",
			"hat-trick",
			"high-roller",
			"surveyor",
			"cartographer",
			"completionist",
			"flawless",
			"speed-run",
		];
		for (const id of expected) {
			expect(ids).toContain(id);
		}
	});

	it("every definition has id, name, description, and icon", () => {
		for (const a of ACHIEVEMENTS) {
			expect(a.id).toBeTruthy();
			expect(a.name).toBeTruthy();
			expect(a.description).toBeTruthy();
			expect(a.icon).toBeTruthy();
		}
	});
});

// --- Streaks / habit ---

describe("first-timer", () => {
	it("not earned with 0 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 0 }), noFeat, POOL)).not.toContain("first-timer");
	});

	it("earned with 1 week played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 1 }), noFeat, POOL)).toContain("first-timer");
	});

	it("earned with many weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 20 }), noFeat, POOL)).toContain("first-timer");
	});
});

describe("committed", () => {
	it("not earned with 9 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 9 }), noFeat, POOL)).not.toContain("committed");
	});

	it("earned at exactly 10 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 10 }), noFeat, POOL)).toContain("committed");
	});

	it("earned with 11 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 11 }), noFeat, POOL)).toContain("committed");
	});
});

describe("veteran", () => {
	it("not earned with 49 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 49 }), noFeat, POOL)).not.toContain("veteran");
	});

	it("earned at exactly 50 weeks played", () => {
		expect(evaluateAchievements(makeStats({ weeksPlayed: 50 }), noFeat, POOL)).toContain("veteran");
	});
});

describe("regular", () => {
	it("not earned with currentStreak 3 and longestStreak 3", () => {
		expect(
			evaluateAchievements(
				makeStats({ currentStreak: 3, longestStreak: 3 }),
				noFeat,
				POOL,
			),
		).not.toContain("regular");
	});

	it("earned when currentStreak >= 4", () => {
		expect(
			evaluateAchievements(
				makeStats({ currentStreak: 4, longestStreak: 3 }),
				noFeat,
				POOL,
			),
		).toContain("regular");
	});

	it("earned when longestStreak >= 4 even if currentStreak < 4", () => {
		expect(
			evaluateAchievements(
				makeStats({ currentStreak: 1, longestStreak: 4 }),
				noFeat,
				POOL,
			),
		).toContain("regular");
	});
});

describe("devotee", () => {
	it("not earned with longestStreak 11", () => {
		expect(evaluateAchievements(makeStats({ longestStreak: 11 }), noFeat, POOL)).not.toContain("devotee");
	});

	it("earned at exactly longestStreak 12", () => {
		expect(evaluateAchievements(makeStats({ longestStreak: 12 }), noFeat, POOL)).toContain("devotee");
	});
});

describe("year-round", () => {
	it("not earned with longestStreak 51", () => {
		expect(evaluateAchievements(makeStats({ longestStreak: 51 }), noFeat, POOL)).not.toContain("year-round");
	});

	it("earned at exactly longestStreak 52", () => {
		expect(evaluateAchievements(makeStats({ longestStreak: 52 }), noFeat, POOL)).toContain("year-round");
	});
});

// --- Lifetime mastery ---

describe("century", () => {
	it("not earned with 99 lifetimeCorrect", () => {
		expect(evaluateAchievements(makeStats({ lifetimeCorrect: 99 }), noFeat, POOL)).not.toContain("century");
	});

	it("earned at exactly 100 lifetimeCorrect", () => {
		expect(evaluateAchievements(makeStats({ lifetimeCorrect: 100 }), noFeat, POOL)).toContain("century");
	});

	it("earned with 500 lifetimeCorrect", () => {
		expect(evaluateAchievements(makeStats({ lifetimeCorrect: 500 }), noFeat, POOL)).toContain("century");
	});
});

describe("polyglot", () => {
	it("not earned with 499 lifetimeCorrect", () => {
		expect(evaluateAchievements(makeStats({ lifetimeCorrect: 499 }), noFeat, POOL)).not.toContain("polyglot");
	});

	it("earned at exactly 500 lifetimeCorrect", () => {
		expect(evaluateAchievements(makeStats({ lifetimeCorrect: 500 }), noFeat, POOL)).toContain("polyglot");
	});
});

describe("sandbox-sensei", () => {
	it("not earned with perCategoryCorrect.sandbox 24", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 24, incubating: 0, graduated: 0, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).not.toContain("sandbox-sensei");
	});

	it("earned at exactly perCategoryCorrect.sandbox 25", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 25, incubating: 0, graduated: 0, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).toContain("sandbox-sensei");
	});
});

describe("incubator", () => {
	it("not earned with perCategoryCorrect.incubating 24", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 24, graduated: 0, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).not.toContain("incubator");
	});

	it("earned at exactly perCategoryCorrect.incubating 25", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 25, graduated: 0, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).toContain("incubator");
	});
});

describe("honor-roll", () => {
	it("not earned with perCategoryCorrect.graduated 24", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 0, graduated: 24, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).not.toContain("honor-roll");
	});

	it("earned at exactly perCategoryCorrect.graduated 25", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 0, graduated: 25, archived: 0, nonCncf: 0 } }),
				noFeat,
				POOL,
			),
		).toContain("honor-roll");
	});
});

describe("off-the-map", () => {
	it("not earned with perCategoryCorrect.nonCncf 24", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 0, graduated: 0, archived: 0, nonCncf: 24 } }),
				noFeat,
				POOL,
			),
		).not.toContain("off-the-map");
	});

	it("earned at exactly perCategoryCorrect.nonCncf 25", () => {
		expect(
			evaluateAchievements(
				makeStats({ perCategoryCorrect: { sandbox: 0, incubating: 0, graduated: 0, archived: 0, nonCncf: 25 } }),
				noFeat,
				POOL,
			),
		).toContain("off-the-map");
	});
});

// --- Competition ---

describe("podium", () => {
	it("not earned with 0 podiums", () => {
		expect(evaluateAchievements(makeStats({ podiums: 0 }), noFeat, POOL)).not.toContain("podium");
	});

	it("earned at exactly 1 podium", () => {
		expect(evaluateAchievements(makeStats({ podiums: 1 }), noFeat, POOL)).toContain("podium");
	});
});

describe("champion", () => {
	it("not earned with 0 wins", () => {
		expect(evaluateAchievements(makeStats({ wins: 0 }), noFeat, POOL)).not.toContain("champion");
	});

	it("earned at exactly 1 win", () => {
		expect(evaluateAchievements(makeStats({ wins: 1 }), noFeat, POOL)).toContain("champion");
	});
});

describe("hat-trick", () => {
	it("not earned with 2 wins", () => {
		expect(evaluateAchievements(makeStats({ wins: 2 }), noFeat, POOL)).not.toContain("hat-trick");
	});

	it("earned at exactly 3 wins", () => {
		expect(evaluateAchievements(makeStats({ wins: 3 }), noFeat, POOL)).toContain("hat-trick");
	});

	it("earned with more than 3 wins", () => {
		expect(evaluateAchievements(makeStats({ wins: 10 }), noFeat, POOL)).toContain("hat-trick");
	});
});

describe("high-roller", () => {
	it("not earned with bestScore 4999", () => {
		expect(evaluateAchievements(makeStats({ bestScore: 4999 }), noFeat, POOL)).not.toContain("high-roller");
	});

	it("earned at exactly bestScore 5000", () => {
		expect(evaluateAchievements(makeStats({ bestScore: 5000 }), noFeat, POOL)).toContain("high-roller");
	});
});

// --- Completion ---

describe("surveyor", () => {
	it("not earned when correctLogos.length < 25% of poolSize", () => {
		// 24 out of 100 = 24%
		const logos = Array.from({ length: 24 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).not.toContain("surveyor");
	});

	it("earned at exactly 25% of poolSize", () => {
		const logos = Array.from({ length: 25 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).toContain("surveyor");
	});

	it("earned above 25% of poolSize", () => {
		const logos = Array.from({ length: 50 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).toContain("surveyor");
	});
});

describe("cartographer", () => {
	it("not earned when correctLogos.length < 50% of poolSize", () => {
		const logos = Array.from({ length: 49 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).not.toContain("cartographer");
	});

	it("earned at exactly 50% of poolSize", () => {
		const logos = Array.from({ length: 50 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).toContain("cartographer");
	});
});

describe("completionist", () => {
	it("not earned when correctLogos.length < poolSize", () => {
		const logos = Array.from({ length: 99 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).not.toContain("completionist");
	});

	it("earned when correctLogos.length equals poolSize", () => {
		const logos = Array.from({ length: 100 }, (_, i) => `logo-${i}`);
		expect(
			evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100),
		).toContain("completionist");
	});

	it("completionist also grants surveyor and cartographer", () => {
		const logos = Array.from({ length: 100 }, (_, i) => `logo-${i}`);
		const earned = evaluateAchievements(makeStats({ correctLogos: logos }), noFeat, 100);
		expect(earned).toContain("surveyor");
		expect(earned).toContain("cartographer");
		expect(earned).toContain("completionist");
	});

	it("no completion achievements when poolSize is 0", () => {
		const earned = evaluateAchievements(makeStats({ correctLogos: [] }), noFeat, 0);
		expect(earned).not.toContain("surveyor");
		expect(earned).not.toContain("cartographer");
		expect(earned).not.toContain("completionist");
	});
});

// --- Per-week feats ---

describe("flawless", () => {
	it("not earned when perfect is false", () => {
		expect(evaluateAchievements(makeStats(), noFeat, POOL)).not.toContain("flawless");
	});

	it("earned when perfect is true", () => {
		expect(evaluateAchievements(makeStats(), perfectFeat, POOL)).toContain("flawless");
	});
});

describe("speed-run", () => {
	it("not earned when fastWeek is false", () => {
		expect(evaluateAchievements(makeStats(), noFeat, POOL)).not.toContain("speed-run");
	});

	it("earned when fastWeek is true", () => {
		expect(evaluateAchievements(makeStats(), fastFeat, POOL)).toContain("speed-run");
	});
});

// --- Combined / edge cases ---

describe("evaluateAchievements combined", () => {
	it("returns empty array for a brand new player with no feats", () => {
		expect(evaluateAchievements(makeStats(), noFeat, POOL)).toEqual([]);
	});

	it("can earn both flawless and speed-run in the same week", () => {
		const earned = evaluateAchievements(makeStats(), bothFeats, POOL);
		expect(earned).toContain("flawless");
		expect(earned).toContain("speed-run");
	});

	it("a seasoned player earns many achievements at once", () => {
		const stats = makeStats({
			weeksPlayed: 52,
			currentStreak: 52,
			longestStreak: 52,
			lifetimeCorrect: 500,
			perCategoryCorrect: { sandbox: 25, incubating: 25, graduated: 25, archived: 5, nonCncf: 25 },
			bestScore: 5000,
			perfectWeeks: 10,
			correctLogos: Array.from({ length: 100 }, (_, i) => `logo-${i}`),
			wins: 3,
			podiums: 5,
			bestRank: 1,
		});
		const earned = evaluateAchievements(stats, bothFeats, 100);
		expect(earned).toContain("first-timer");
		expect(earned).toContain("committed");
		expect(earned).toContain("veteran");
		expect(earned).toContain("regular");
		expect(earned).toContain("devotee");
		expect(earned).toContain("year-round");
		expect(earned).toContain("century");
		expect(earned).toContain("polyglot");
		expect(earned).toContain("sandbox-sensei");
		expect(earned).toContain("incubator");
		expect(earned).toContain("honor-roll");
		expect(earned).toContain("off-the-map");
		expect(earned).toContain("podium");
		expect(earned).toContain("champion");
		expect(earned).toContain("hat-trick");
		expect(earned).toContain("high-roller");
		expect(earned).toContain("surveyor");
		expect(earned).toContain("cartographer");
		expect(earned).toContain("completionist");
		expect(earned).toContain("flawless");
		expect(earned).toContain("speed-run");
	});

	it("champion does not imply hat-trick when wins < 3", () => {
		const earned = evaluateAchievements(makeStats({ wins: 1 }), noFeat, POOL);
		expect(earned).toContain("champion");
		expect(earned).not.toContain("hat-trick");
	});

	it("committed does not imply veteran when weeksPlayed < 50", () => {
		const earned = evaluateAchievements(makeStats({ weeksPlayed: 10 }), noFeat, POOL);
		expect(earned).toContain("committed");
		expect(earned).not.toContain("veteran");
	});

	it("century does not imply polyglot when lifetimeCorrect < 500", () => {
		const earned = evaluateAchievements(makeStats({ lifetimeCorrect: 100 }), noFeat, POOL);
		expect(earned).toContain("century");
		expect(earned).not.toContain("polyglot");
	});
});
