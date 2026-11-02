import type { KubeTrackStage } from "./types";

/** The parts of a question that scoring and state restore need. */
export interface ScorableQuestion {
	id: string;
	answerIds: ReadonlyArray<string>;
	choices?: ReadonlyArray<{ id: string }>;
	stage?: KubeTrackStage | undefined;
}

/** Question id → the choice ids the learner submitted. */
export type QuizAnswers = Record<string, string[]>;

export interface QuestionResult {
	id: string;
	answered: boolean;
	correct: boolean;
}

export interface QuizResults {
	correct: number;
	total: number;
	percent: number;
	perQuestion: QuestionResult[];
	byStage: Partial<Record<KubeTrackStage, { correct: number; total: number }>>;
}

type QuizBand = "Release ready" | "Solid" | "Keep exploring";

export interface QuizState {
	/** `release.updatedAt` when the state was saved; a mismatch discards it. */
	version: string;
	answers: QuizAnswers;
	index: number;
	attempt: number;
	completed: boolean;
}

/** Exact set match: every correct choice and nothing else. */
export function isCorrect(
	question: Pick<ScorableQuestion, "answerIds">,
	answerIds: ReadonlyArray<string> | undefined,
): boolean {
	if (!answerIds || answerIds.length === 0) return false;
	const given = new Set(answerIds);
	const expected = new Set(question.answerIds);
	if (given.size !== expected.size) return false;
	for (const id of given) if (!expected.has(id)) return false;
	return true;
}

export function scoreQuiz(
	questions: ReadonlyArray<ScorableQuestion>,
	answers: QuizAnswers,
): QuizResults {
	const byStage: QuizResults["byStage"] = {};
	const perQuestion = questions.map((question) => {
		const given = answers[question.id];
		const result: QuestionResult = {
			id: question.id,
			answered: Boolean(given && given.length > 0),
			correct: isCorrect(question, given),
		};
		if (question.stage) {
			const bucket = byStage[question.stage] ?? { correct: 0, total: 0 };
			byStage[question.stage] = bucket;
			bucket.total++;
			if (result.correct) bucket.correct++;
		}
		return result;
	});
	const correct = perQuestion.filter((result) => result.correct).length;
	const total = questions.length;
	const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
	return { correct, total, percent, perQuestion, byStage };
}

/** Ids of questions that were answered wrongly or not at all, in quiz order. */
export function missedIds(
	questions: ReadonlyArray<ScorableQuestion>,
	answers: QuizAnswers,
): string[] {
	return questions
		.filter((question) => !isCorrect(question, answers[question.id]))
		.map((question) => question.id);
}

export function band(percent: number): QuizBand {
	if (percent >= 90) return "Release ready";
	if (percent >= 70) return "Solid";
	return "Keep exploring";
}

export const storageKey = (releaseId: string): string =>
	`kubetrack:v1:${releaseId}:quiz`;

export const serializeState = (state: QuizState): string =>
	JSON.stringify(state);

/**
 * Parse saved state, keeping only answers for questions and choices that still
 * exist. Returns null for unparseable state or state saved against a different
 * version of the release.
 */
export function restoreState(
	raw: string | null | undefined,
	questions: ReadonlyArray<ScorableQuestion>,
	version: string,
): QuizState | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const saved = parsed as Partial<QuizState>;
	if (saved.version !== version) return null;

	const answers: QuizAnswers = {};
	const savedAnswers =
		saved.answers && typeof saved.answers === "object" ? saved.answers : {};
	for (const question of questions) {
		const given = (savedAnswers as Record<string, unknown>)[question.id];
		if (!Array.isArray(given)) continue;
		const known = new Set(
			(question.choices ?? question.answerIds.map((id) => ({ id }))).map(
				(choice) => choice.id,
			),
		);
		const kept = [
			...new Set(
				given.filter(
					(id): id is string => typeof id === "string" && known.has(id),
				),
			),
		];
		if (kept.length > 0) answers[question.id] = kept;
	}

	const lastIndex = Math.max(questions.length - 1, 0);
	const index =
		typeof saved.index === "number" && Number.isFinite(saved.index)
			? Math.min(Math.max(Math.trunc(saved.index), 0), lastIndex)
			: 0;
	const attempt =
		typeof saved.attempt === "number" && saved.attempt >= 1
			? Math.trunc(saved.attempt)
			: 1;
	return {
		version,
		answers,
		index,
		attempt,
		completed: saved.completed === true,
	};
}

/** Spoiler-free share text: score, a ✓/× row and the page URL. */
export function shareText(
	release: { id: string; url: string },
	results: Pick<QuizResults, "correct" | "total" | "perQuestion">,
): string {
	const row = results.perQuestion
		.map((result) => (result.correct ? "✓" : "×"))
		.join("");
	return [
		`KubeTrack ${release.id} — ${results.correct}/${results.total}`,
		row,
		release.url,
	]
		.filter(Boolean)
		.join("\n");
}
