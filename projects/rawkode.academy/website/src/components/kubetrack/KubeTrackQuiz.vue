<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { KUBETRACK_EVENTS, track } from "@/lib/kubetrack/analytics";
import {
	isCorrect,
	missedIds,
	type QuizState,
	restoreState,
	type ScorableQuestion,
	scoreQuiz,
	serializeState,
	storageKey,
} from "@/lib/kubetrack/quiz";
import type { QuizQuestionProps } from "@/lib/kubetrack/view-model";
// biome-ignore lint/style/useImportType: used as a component in the template
import QuizQuestion from "./QuizQuestion.vue";
// biome-ignore lint/style/useImportType: used as a component in the template
import QuizResults from "./QuizResults.vue";

const props = defineProps<{
	releaseId: string;
	/** `release.updatedAt`; saved state from another version is discarded. */
	version: string;
	questions: QuizQuestionProps[];
	/** Canonical page URL for share text. */
	shareUrl: string;
}>();

const theme = academyGame();
const fresh = (attempt: number): QuizState => ({
	version: props.version,
	answers: {},
	index: 0,
	attempt,
	completed: false,
});

const ready = ref(false);
const state = ref<QuizState>(fresh(1));
const started = ref(false);
const announcement = ref("");
const questionView = ref<InstanceType<typeof QuizQuestion> | null>(null);
const resultsView = ref<InstanceType<typeof QuizResults> | null>(null);

const scorable = computed<ScorableQuestion[]>(() =>
	props.questions.map((question) => ({
		id: question.id,
		answerIds: question.answerIds,
		choices: question.choices,
		stage: question.stage,
	})),
);
const total = computed(() => props.questions.length);
const current = computed(() => props.questions[state.value.index]);
const results = computed(() => scoreQuiz(scorable.value, state.value.answers));
const answeredCount = computed(
	() => results.value.perQuestion.filter((result) => result.answered).length,
);

const kepOf = (question: QuizQuestionProps) => {
	const match = /^kep-(\d+)$/.exec(question.featureSlug ?? "");
	return match ? Number(match[1]) : undefined;
};
const isAnswered = (index: number) =>
	(state.value.answers[props.questions[index]?.id ?? ""]?.length ?? 0) > 0;

/** The next unanswered question after `from`, wrapping round; null when all are answered. */
function nextUnanswered(from: number): number | null {
	for (let step = 1; step <= total.value; step++) {
		const index = (from + step) % total.value;
		if (!isAnswered(index)) return index;
	}
	return null;
}
const hasNext = computed(() => nextUnanswered(state.value.index) !== null);

function save() {
	try {
		window.localStorage.setItem(
			storageKey(props.releaseId),
			serializeState(state.value),
		);
	} catch {
		// Storage can be blocked; the quiz still works for this visit.
	}
}

async function focusQuestion() {
	await nextTick();
	questionView.value?.focusHeading();
}

function onSubmit(answerIds: string[]) {
	const question = current.value;
	if (!question) return;
	if (!started.value) {
		started.value = true;
		track(KUBETRACK_EVENTS.QUIZ_STARTED, {
			release: props.releaseId,
			questionCount: total.value,
			fromCards: window.location.hash !== "#quiz",
		});
	}
	state.value.answers = { ...state.value.answers, [question.id]: answerIds };
	track(KUBETRACK_EVENTS.QUESTION_ANSWERED, {
		release: props.releaseId,
		questionId: question.id,
		kind: question.kind,
		kep: kepOf(question),
		stage: question.stage,
		correct: isCorrect(question, answerIds),
	});
}

async function onNext() {
	const next = nextUnanswered(state.value.index);
	if (next === null) {
		state.value.completed = true;
		const { correct, percent } = results.value;
		track(KUBETRACK_EVENTS.QUIZ_COMPLETED, {
			release: props.releaseId,
			score: correct,
			total: total.value,
			percent,
			perfect: correct === total.value,
			attempt: state.value.attempt,
		});
		// Focus moves to the results heading, which reads the score.
		announcement.value = "";
		await nextTick();
		resultsView.value?.focusHeading();
		return;
	}
	state.value.index = next;
	// Focus moves to the question heading, which reads "Question N of M".
	announcement.value = "";
	await focusQuestion();
}

function onReviewCard() {
	const question = current.value;
	if (!question) return;
	track(KUBETRACK_EVENTS.REVIEW_CARD_CLICKED, {
		release: props.releaseId,
		questionId: question.id,
		kep: kepOf(question),
	});
}

async function onRetryMissed() {
	const missed = new Set(missedIds(scorable.value, state.value.answers));
	const first = props.questions.findIndex((question) =>
		missed.has(question.id),
	);
	if (first === -1) return;
	const answers = Object.fromEntries(
		props.questions
			.filter((question) => !missed.has(question.id))
			.map((question) => [question.id, state.value.answers[question.id] ?? []]),
	);
	state.value = {
		...state.value,
		answers,
		index: first,
		attempt: state.value.attempt + 1,
		completed: false,
	};
	track(KUBETRACK_EVENTS.QUIZ_RETRY, {
		release: props.releaseId,
		type: "missed",
	});
	announcement.value = `Retrying ${missed.size} missed ${missed.size === 1 ? "question" : "questions"}.`;
	await focusQuestion();
}

async function onRestart() {
	state.value = fresh(state.value.attempt + 1);
	track(KUBETRACK_EVENTS.QUIZ_RETRY, { release: props.releaseId, type: "all" });
	announcement.value = "";
	await focusQuestion();
}

onMounted(() => {
	let raw: string | null = null;
	try {
		raw = window.localStorage.getItem(storageKey(props.releaseId));
	} catch {
		raw = null;
	}
	const restored = restoreState(raw, scorable.value, props.version);
	if (restored) {
		state.value = restored;
		started.value = Object.keys(restored.answers).length > 0;
	}
	ready.value = true;
	watch(state, save, { deep: true });
});
</script>

<template>
	<div :class="theme.root" class="kt-quiz" data-kubetrack-quiz>
		<div class="kt-quiz-header">
			<h2 class="kt-quiz-title">Release quiz</h2>
			<p class="kt-quiz-meta">
				{{ total }} {{ total === 1 ? "question" : "questions" }} · instant feedback
			</p>
		</div>

		<template v-if="ready && total > 0">
			<div v-if="!state.completed" class="kt-quiz-progress">
				<label class="kt-quiz-progress-label" :for="`kt-progress-${releaseId}`">
					{{ answeredCount }} of {{ total }} answered
				</label>
				<progress
					:id="`kt-progress-${releaseId}`"
					class="kt-quiz-progress-bar"
					:max="total"
					:value="answeredCount"
				/>
			</div>

			<QuizResults
				v-if="state.completed"
				ref="resultsView"
				:release-id="releaseId"
				:questions="questions"
				:results="results"
				:share-url="shareUrl"
				@retry-missed="onRetryMissed"
				@restart="onRestart"
			/>

			<QuizQuestion
				v-else-if="current"
				ref="questionView"
				:key="`${current.id}:${state.attempt}`"
				:question="current"
				:number="state.index + 1"
				:total="total"
				:submitted="state.answers[current.id]"
				:has-next="hasNext"
				@submit="onSubmit"
				@next="onNext"
				@review-card="onReviewCard"
			/>
		</template>

		<p class="kt-visually-hidden" role="status" aria-live="polite">{{ announcement }}</p>
	</div>
</template>

<style scoped>
.kt-quiz {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	width: 100%;
	max-width: 42.5rem;
	margin: 0 auto;
}

.kt-quiz-header {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.25rem 1rem;
	padding-bottom: 0.75rem;
	border-bottom: 1px solid var(--colors-academy-border);
}

.kt-quiz-title {
	margin: 0;
	font-family: var(--fonts-academy-display);
	font-size: 1.75rem;
	font-weight: 700;
	line-height: 1.15;
	color: var(--colors-academy-text);
}

.kt-quiz-meta {
	margin: 0;
	font-family: var(--fonts-academy-mono);
	font-size: 0.8125rem;
	color: var(--colors-academy-text-muted);
}

.kt-quiz-progress {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.kt-quiz-progress-label {
	font-family: var(--fonts-academy-mono);
	font-size: 0.8125rem;
	color: var(--colors-academy-text-soft);
}

.kt-quiz-progress-bar {
	width: 100%;
	height: 0.375rem;
	border: 0;
	border-radius: 3px;
	overflow: hidden;
	appearance: none;
	background: var(--colors-academy-segment-off);
	accent-color: var(--colors-academy-accent);
}

.kt-quiz-progress-bar::-webkit-progress-bar {
	background: var(--colors-academy-segment-off);
}

.kt-quiz-progress-bar::-webkit-progress-value {
	background: var(--colors-academy-accent);
	transition: width 180ms ease-out;
}

.kt-quiz-progress-bar::-moz-progress-bar {
	background: var(--colors-academy-accent);
}

.kt-visually-hidden {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}
</style>
