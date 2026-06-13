import { describe, expect, it } from "vitest";
import type { Logo, Round } from "./guess-the-logo";
import { ACHIEVEMENTS, NAMESPACE, evaluateAchievements } from "./guess-the-logo-achievements";

// --- Helpers ---

function makeRound(name: string, cncfStatus: Logo["cncfStatus"]): Round {
	return {
		logo: { name, iconUrl: `https://example.com/${name}.svg`, cncfStatus },
		options: [name, "Other-A", "Other-B", "Other-C"],
		answer: name,
	};
}

/** Build a 5-round set using a mix of statuses */
function makeMixedRounds(): Round[] {
	return [
		makeRound("Sandbox-1", "sandbox"),
		makeRound("Incubating-1", "incubating"),
		makeRound("Graduated-1", "graduated"),
		makeRound("NonCncf-1", null),
		makeRound("Archived-1", "archived"),
	];
}

// --- NAMESPACE ---

describe("NAMESPACE", () => {
	it("is guess-the-logo", () => {
		expect(NAMESPACE).toBe("guess-the-logo");
	});
});

// --- ACHIEVEMENTS list ---

describe("ACHIEVEMENTS", () => {
	it("contains all 6 definitions", () => {
		expect(ACHIEVEMENTS).toHaveLength(6);
	});

	it("has the expected ids", () => {
		const ids = ACHIEVEMENTS.map((a) => a.id);
		expect(ids).toContain("perfect-run");
		expect(ids).toContain("halfway-there");
		expect(ids).toContain("sandbox-surfer");
		expect(ids).toContain("incubating-insider");
		expect(ids).toContain("graduated-genius");
		expect(ids).toContain("non-cncf-hero");
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

// --- perfect-run ---

describe("perfect-run", () => {
	it("earned when all 5 correct", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("perfect-run");
	});

	it("not earned when one answer is wrong", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		answers[0] = "wrong";
		expect(evaluateAchievements(rounds, answers)).not.toContain("perfect-run");
	});

	it("not earned when one answer is null (timeout)", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		answers[4] = null;
		expect(evaluateAchievements(rounds, answers)).not.toContain("perfect-run");
	});

	it("not earned when fewer than 5 rounds even if all correct", () => {
		// perfect-run requires exactly 5/5
		const rounds = makeMixedRounds().slice(0, 3);
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).not.toContain("perfect-run");
	});
});

// --- halfway-there ---

describe("halfway-there", () => {
	it("earned with exactly 5/5 correct", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("halfway-there");
	});

	it("earned with 5/5 correct (all rounds)", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("halfway-there");
	});

	it("not earned with 4 correct", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r, i) =>
			i < 4 ? r.answer : null,
		);
		expect(evaluateAchievements(rounds, answers)).not.toContain("halfway-there");
	});

	it("not earned with all wrong", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map(() => null);
		expect(evaluateAchievements(rounds, answers)).not.toContain("halfway-there");
	});
});

// --- sandbox-surfer ---

describe("sandbox-surfer", () => {
	it("earned when all sandbox logos answered correctly", () => {
		const rounds = makeMixedRounds();
		// Answer all correctly
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("sandbox-surfer");
	});

	it("not earned when one sandbox logo is missed", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		// index 0 is Sandbox-1
		answers[0] = null;
		expect(evaluateAchievements(rounds, answers)).not.toContain("sandbox-surfer");
	});

	it("not earned when no sandbox logos in run", () => {
		const rounds: Round[] = [
			makeRound("Grad-1", "graduated"),
			makeRound("Inc-1", "incubating"),
			makeRound("NonCncf-1", null),
			makeRound("NonCncf-2", null),
			makeRound("NonCncf-3", null),
		];
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).not.toContain("sandbox-surfer");
	});
});

// --- incubating-insider ---

describe("incubating-insider", () => {
	it("earned when all incubating logos answered correctly", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("incubating-insider");
	});

	it("not earned when one incubating logo is answered wrong", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		// index 1 is Incubating-1
		answers[1] = "wrong";
		expect(evaluateAchievements(rounds, answers)).not.toContain("incubating-insider");
	});

	it("not earned when no incubating logos in run", () => {
		const rounds: Round[] = Array.from({ length: 5 }, (_, i) =>
			makeRound(`Sandbox-${i}`, "sandbox"),
		);
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).not.toContain("incubating-insider");
	});
});

// --- graduated-genius ---

describe("graduated-genius", () => {
	it("earned when all graduated logos answered correctly", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("graduated-genius");
	});

	it("not earned when one graduated logo is a timeout", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		// index 2 is Graduated-1
		answers[2] = null;
		expect(evaluateAchievements(rounds, answers)).not.toContain("graduated-genius");
	});

	it("not earned when no graduated logos in run", () => {
		const rounds: Round[] = Array.from({ length: 5 }, (_, i) =>
			makeRound(`Inc-${i}`, "incubating"),
		);
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).not.toContain("graduated-genius");
	});
});

// --- non-cncf-hero ---

describe("non-cncf-hero", () => {
	it("earned when all null-status logos answered correctly", () => {
		const rounds = makeMixedRounds();
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).toContain("non-cncf-hero");
	});

	it("not earned when one non-CNCF logo is wrong", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		// index 3 is NonCncf-1
		answers[3] = "wrong";
		expect(evaluateAchievements(rounds, answers)).not.toContain("non-cncf-hero");
	});

	it("not earned when no non-CNCF logos in run", () => {
		const rounds: Round[] = Array.from({ length: 5 }, (_, i) =>
			makeRound(`Sandbox-${i}`, "sandbox"),
		);
		const answers = rounds.map((r) => r.answer);
		expect(evaluateAchievements(rounds, answers)).not.toContain("non-cncf-hero");
	});

	it("not earned when one non-CNCF logo is a timeout", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map((r) => r.answer);
		// index 3 is NonCncf-1
		answers[3] = null;
		expect(evaluateAchievements(rounds, answers)).not.toContain("non-cncf-hero");
	});
});

// --- evaluateAchievements: combined / edge cases ---

describe("evaluateAchievements edge cases", () => {
	it("returns empty array when all wrong", () => {
		const rounds = makeMixedRounds();
		const answers: (string | null)[] = rounds.map(() => null);
		expect(evaluateAchievements(rounds, answers)).toEqual([]);
	});

	it("can earn both sandbox-surfer and non-cncf-hero in the same run", () => {
		const rounds: Round[] = [
			makeRound("Sandbox-1", "sandbox"),
			makeRound("NonCncf-1", null),
			makeRound("Incubating-1", "incubating"),
			makeRound("Incubating-2", "incubating"),
			makeRound("Incubating-3", "incubating"),
		];
		const answers = rounds.map((r) => r.answer);
		const earned = evaluateAchievements(rounds, answers);
		expect(earned).toContain("sandbox-surfer");
		expect(earned).toContain("non-cncf-hero");
		expect(earned).toContain("incubating-insider");
	});
});
