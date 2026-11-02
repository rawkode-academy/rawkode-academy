import { describe, expect, it } from "vitest";
import {
	band,
	isCorrect,
	missedIds,
	type QuizState,
	restoreState,
	type ScorableQuestion,
	scoreQuiz,
	serializeState,
	shareText,
	storageKey,
} from "./quiz";

const choices = (...ids: string[]) => ids.map((id) => ({ id }));

const questions: ScorableQuestion[] = [
	{
		id: "1.37/q01",
		answerIds: ["b"],
		choices: choices("a", "b", "c", "d"),
		stage: "stable",
	},
	{
		id: "1.37/q02",
		answerIds: ["a", "c"],
		choices: choices("a", "b", "c", "d"),
		stage: "beta",
	},
	{
		id: "1.37/q03",
		answerIds: ["a"],
		choices: choices("a", "b"),
		stage: "alpha",
	},
	{
		id: "1.37/q04",
		answerIds: ["d"],
		choices: choices("a", "b", "c", "d"),
		stage: "stable",
	},
];

describe("isCorrect", () => {
	it("requires an exact set match", () => {
		const multiple = questions[1]!;
		expect(isCorrect(multiple, ["a", "c"])).toBe(true);
		expect(isCorrect(multiple, ["c", "a"])).toBe(true);
		expect(isCorrect(multiple, ["a"])).toBe(false);
		expect(isCorrect(multiple, ["a", "b", "c"])).toBe(false);
		expect(isCorrect(multiple, ["a", "a"])).toBe(false);
	});

	it("treats a missing or empty answer as wrong", () => {
		expect(isCorrect(questions[0]!, undefined)).toBe(false);
		expect(isCorrect(questions[0]!, [])).toBe(false);
	});
});

describe("scoreQuiz", () => {
	const answers = {
		"1.37/q01": ["b"],
		"1.37/q02": ["a"],
		"1.37/q03": ["a"],
	};

	it("scores per question, overall and by stage", () => {
		expect(scoreQuiz(questions, answers)).toEqual({
			correct: 2,
			total: 4,
			percent: 50,
			perQuestion: [
				{ id: "1.37/q01", answered: true, correct: true },
				{ id: "1.37/q02", answered: true, correct: false },
				{ id: "1.37/q03", answered: true, correct: true },
				{ id: "1.37/q04", answered: false, correct: false },
			],
			byStage: {
				stable: { correct: 1, total: 2 },
				beta: { correct: 0, total: 1 },
				alpha: { correct: 1, total: 1 },
			},
		});
	});

	it("handles an empty quiz", () => {
		expect(scoreQuiz([], {})).toMatchObject({
			correct: 0,
			total: 0,
			percent: 0,
		});
	});

	it("lists missed and unanswered questions in order", () => {
		expect(missedIds(questions, answers)).toEqual(["1.37/q02", "1.37/q04"]);
	});
});

describe("band", () => {
	it.each([
		[100, "Release ready"],
		[90, "Release ready"],
		[89, "Solid"],
		[70, "Solid"],
		[69, "Keep exploring"],
		[0, "Keep exploring"],
	])("%i%% is %s", (percent, expected) => {
		expect(band(percent)).toBe(expected);
	});
});

describe("state", () => {
	const version = "2026-11-01T00:00:00.000Z";
	const state: QuizState = {
		version,
		answers: { "1.37/q01": ["b"], "1.37/q02": ["a", "c"] },
		index: 2,
		attempt: 1,
		completed: false,
	};

	it("uses a versioned storage key per release", () => {
		expect(storageKey("1.37")).toBe("kubetrack:v1:1.37:quiz");
	});

	it("round-trips", () => {
		expect(restoreState(serializeState(state), questions, version)).toEqual(
			state,
		);
	});

	it("discards state saved against another version of the release", () => {
		expect(
			restoreState(
				serializeState(state),
				questions,
				"2026-11-02T00:00:00.000Z",
			),
		).toBeNull();
	});

	it("discards missing or corrupt state", () => {
		expect(restoreState(null, questions, version)).toBeNull();
		expect(restoreState("", questions, version)).toBeNull();
		expect(restoreState("{not json", questions, version)).toBeNull();
		expect(restoreState("42", questions, version)).toBeNull();
	});

	it("drops unknown question and choice ids and clamps the index", () => {
		const raw = JSON.stringify({
			version,
			answers: {
				"1.37/q01": ["b", "z"],
				"1.37/q02": ["z"],
				"1.37/q03": "a",
				"1.37/q99": ["a"],
			},
			index: 40,
			attempt: 3,
			completed: true,
		});
		expect(restoreState(raw, questions, version)).toEqual({
			version,
			answers: { "1.37/q01": ["b"] },
			index: 3,
			attempt: 3,
			completed: true,
		});
	});

	it("fills defaults for missing fields", () => {
		expect(
			restoreState(JSON.stringify({ version }), questions, version),
		).toEqual({
			version,
			answers: {},
			index: 0,
			attempt: 1,
			completed: false,
		});
	});
});

describe("shareText", () => {
	it("shares the score and a row without revealing answers", () => {
		const results = scoreQuiz(questions, {
			"1.37/q01": ["b"],
			"1.37/q02": ["a", "c"],
			"1.37/q03": ["b"],
			"1.37/q04": ["d"],
		});
		const text = shareText(
			{ id: "1.37", url: "https://rawkode.academy/kubetrack/1.37" },
			results,
		);
		expect(text).toBe(
			"KubeTrack 1.37 — 3/4\n✓✓×✓\nhttps://rawkode.academy/kubetrack/1.37",
		);
		expect(text).not.toMatch(/\b[a-d]\b/);
	});
});
