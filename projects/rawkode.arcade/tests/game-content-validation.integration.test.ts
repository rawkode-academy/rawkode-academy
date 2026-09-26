import { describe, expect, it } from "vitest";
import {
	mergeConflictSeed,
	nullPointerSeed,
	principalEngineerSeed,
	raceConditionSeed,
	spinlockSeed,
	tenNinesSeed,
} from "../src/content/seed";
import {
	createMergeConflict,
	createNullPointer,
	createPrincipalEngineer,
	createRaceCondition,
	createSpinlock,
	createTenNines,
} from "../src/games";

describe("production game content contracts", () => {
	it("validates Merge Conflict survey rounds and rejects an empty pack", () => {
		const game = createMergeConflict(mergeConflictSeed);
		expect(game.id).toBe("merge-conflict");
		expect(game.validateContent(mergeConflictSeed)).toEqual({ valid: true, errors: [] });
		expect(game.validateContent({ ...mergeConflictSeed, rounds: [] })).toMatchObject({
			valid: false,
			errors: ["at least one round is required"],
		});
	});

	it("validates Spinlock wheel values and rejects an empty wheel", () => {
		const game = createSpinlock(spinlockSeed);
		expect(game.id).toBe("spinlock");
		expect(game.validateContent(spinlockSeed)).toEqual({ valid: true, errors: [] });
		expect(game.validateContent({ ...spinlockSeed, wheel: [] })).toMatchObject({
			valid: false,
			errors: ["wheel requires values"],
		});
	});

	it("validates Principal Engineer answer indexes and four-choice questions", () => {
		const game = createPrincipalEngineer(principalEngineerSeed);
		expect(game.id).toBe("principal-engineer");
		expect(game.validateContent(principalEngineerSeed)).toEqual({ valid: true, errors: [] });
		const invalid = structuredClone(principalEngineerSeed);
		invalid.questions[0] = { ...invalid.questions[0]!, choices: ["one", "two"], correct: 4 };
		expect(game.validateContent(invalid)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				"question 1 needs four choices",
				"question 1 has invalid correct index",
			]),
		});
	});

	it("validates Race Condition movement and rejects a non-positive finish", () => {
		const game = createRaceCondition(raceConditionSeed);
		expect(game.id).toBe("race-condition");
		expect(game.validateContent(raceConditionSeed)).toEqual({ valid: true, errors: [] });
		expect(game.validateContent({ ...raceConditionSeed, finish: 0 })).toMatchObject({
			valid: false,
			errors: ["finish must be positive"],
		});
	});

	it("validates Ten Nines list size and rejects a nine-answer round", () => {
		const game = createTenNines(tenNinesSeed);
		expect(game.id).toBe("ten-nines");
		expect(game.validateContent(tenNinesSeed)).toEqual({ valid: true, errors: [] });
		const invalid = structuredClone(tenNinesSeed);
		invalid.rounds[0] = { ...invalid.rounds[0]!, answers: invalid.rounds[0]!.answers.slice(0, 9) };
		expect(game.validateContent(invalid)).toMatchObject({
			valid: false,
			errors: ["round 1 needs exactly ten answers"],
		});
	});

	it("validates Null Pointer survey counts and rejects negative responses", () => {
		const game = createNullPointer(nullPointerSeed);
		expect(game.id).toBe("null-pointer");
		expect(game.validateContent(nullPointerSeed)).toEqual({ valid: true, errors: [] });
		const invalid = structuredClone(nullPointerSeed);
		invalid.rounds[0]!.answers[0] = {
			...invalid.rounds[0]!.answers[0]!,
			surveyResponses: -1,
		};
		expect(game.validateContent(invalid)).toMatchObject({
			valid: false,
			errors: ["round 1 has invalid answer"],
		});
	});
});
