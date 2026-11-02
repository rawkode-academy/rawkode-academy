<script setup lang="ts">
import { Checkbox } from "@ark-ui/vue/checkbox";
import { RadioGroup } from "@ark-ui/vue/radio-group";
import { computed, nextTick, ref } from "vue";
import { isCorrect } from "@/lib/kubetrack/quiz";
import type { QuizQuestionProps } from "@/lib/kubetrack/view-model";

const props = defineProps<{
	question: QuizQuestionProps;
	number: number;
	total: number;
	/** The learner's submitted answer; set once the question has been checked. */
	submitted?: string[] | undefined;
	/** Whether another unanswered question follows this one. */
	hasNext: boolean;
}>();

const emit = defineEmits<{
	submit: [answerIds: string[]];
	next: [];
	reviewCard: [];
}>();

const single = ref<string | null>(props.submitted?.[0] ?? null);
const many = ref<string[]>([...(props.submitted ?? [])]);
const error = ref("");
const heading = ref<HTMLElement | null>(null);
const feedback = ref<HTMLElement | null>(null);

const baseId = computed(
	() => `kt-${props.question.id.replace(/[^\w-]/g, "-")}`,
);
const isMultiple = computed(() => props.question.kind === "multiple");
const answered = computed(() => (props.submitted?.length ?? 0) > 0);
const correct = computed(
	() => answered.value && isCorrect(props.question, props.submitted),
);
const selection = computed(() =>
	isMultiple.value ? many.value : single.value ? [single.value] : [],
);
const hint = computed(() => {
	if (props.question.kind === "true_false") return "True or false?";
	if (isMultiple.value)
		return `Choose ${props.question.answerIds.length} answers.`;
	return "Choose one answer.";
});

type ChoiceResult = "correct" | "incorrect" | "missed";
function choiceResult(id: string): ChoiceResult | undefined {
	if (!answered.value) return undefined;
	const isAnswer = props.question.answerIds.includes(id);
	const picked = props.submitted?.includes(id) ?? false;
	if (isAnswer) return picked ? "correct" : "missed";
	return picked ? "incorrect" : undefined;
}
const NOTES: Record<ChoiceResult, string> = {
	correct: "Your answer, correct",
	incorrect: "Your answer",
	missed: "Correct answer",
};

async function submit() {
	if (answered.value) return;
	if (selection.value.length === 0) {
		error.value = isMultiple.value
			? "Choose at least one answer first."
			: "Choose an answer first.";
		return;
	}
	error.value = "";
	emit("submit", [...selection.value]);
	await nextTick();
	feedback.value?.focus();
}

defineExpose({
	focusHeading: () => heading.value?.focus(),
});
</script>

<template>
	<article class="kt-question" :aria-labelledby="`${baseId}-heading`">
		<h3 :id="`${baseId}-heading`" ref="heading" class="kt-question-heading" tabindex="-1">
			Question {{ number }} of {{ total }}
		</h3>
		<!-- eslint-disable-next-line vue/no-v-html -- server-rendered rich text -->
		<div :id="`${baseId}-prompt`" class="kt-question-prompt" v-html="question.promptHtml" />
		<p :id="`${baseId}-hint`" class="kt-question-hint">{{ hint }}</p>

		<form class="kt-question-form" novalidate @submit.prevent="submit">
			<div @keydown.enter.prevent="submit">
				<Checkbox.Group
					v-if="isMultiple"
					v-model="many"
					class="kt-choices"
					:name="question.id"
					:disabled="answered"
					:aria-labelledby="`${baseId}-prompt`"
					:aria-describedby="`${baseId}-hint`"
				>
					<Checkbox.Root
						v-for="choice in question.choices"
						:key="choice.id"
						class="kt-choice"
						:value="choice.id"
						:data-result="choiceResult(choice.id)"
					>
						<Checkbox.Control class="kt-choice-control kt-choice-control--checkbox">
							<Checkbox.Indicator class="kt-choice-indicator" aria-hidden="true">✓</Checkbox.Indicator>
						</Checkbox.Control>
						<Checkbox.Label class="kt-choice-text">{{ choice.text }}</Checkbox.Label>
						<span v-if="choiceResult(choice.id)" class="kt-choice-note">
							{{ NOTES[choiceResult(choice.id)!] }}
						</span>
						<Checkbox.HiddenInput />
					</Checkbox.Root>
				</Checkbox.Group>

				<RadioGroup.Root
					v-else
					v-model="single"
					class="kt-choices"
					:class="{ 'kt-choices--inline': question.kind === 'true_false' }"
					:name="question.id"
					:disabled="answered"
					:aria-labelledby="`${baseId}-prompt`"
					:aria-describedby="`${baseId}-hint`"
				>
					<RadioGroup.Item
						v-for="choice in question.choices"
						:key="choice.id"
						class="kt-choice"
						:value="choice.id"
						:data-result="choiceResult(choice.id)"
					>
						<RadioGroup.ItemControl class="kt-choice-control kt-choice-control--radio" />
						<RadioGroup.ItemText class="kt-choice-text">{{ choice.text }}</RadioGroup.ItemText>
						<span v-if="choiceResult(choice.id)" class="kt-choice-note">
							{{ NOTES[choiceResult(choice.id)!] }}
						</span>
						<RadioGroup.ItemHiddenInput />
					</RadioGroup.Item>
				</RadioGroup.Root>
			</div>

			<p v-if="error" class="kt-question-error" role="alert">{{ error }}</p>
			<button v-if="!answered" type="submit" class="kt-button kt-button--primary">
				Check answer
			</button>
		</form>

		<section
			v-if="answered"
			class="kt-feedback"
			:data-correct="correct"
			:aria-labelledby="`${baseId}-feedback`"
		>
			<h4 :id="`${baseId}-feedback`" ref="feedback" class="kt-feedback-heading" tabindex="-1">
				<template v-if="correct">Correct <span aria-hidden="true">✓</span></template>
				<template v-else>Not quite <span aria-hidden="true">×</span></template>
			</h4>
			<!-- eslint-disable-next-line vue/no-v-html -- server-rendered rich text -->
			<div class="kt-feedback-explanation" v-html="question.explanationHtml" />
			<div class="kt-feedback-actions">
				<a
					v-if="question.featureSlug"
					class="kt-feedback-review"
					:href="`#${question.featureSlug}`"
					@click="emit('reviewCard')"
				>
					Review card <span aria-hidden="true">→</span>
				</a>
				<button type="button" class="kt-button kt-button--primary" @click="emit('next')">
					{{ hasNext ? "Next question" : "See results" }}
				</button>
			</div>
		</section>
	</article>
</template>

<style scoped>
.kt-question {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.kt-question-heading {
	margin: 0;
	font-family: var(--fonts-academy-mono);
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--colors-academy-text-muted);
}

.kt-question-heading:focus-visible,
.kt-feedback-heading:focus-visible {
	outline: 2px solid var(--colors-academy-accent);
	outline-offset: 4px;
	border-radius: 3px;
}

.kt-question-heading:focus:not(:focus-visible),
.kt-feedback-heading:focus:not(:focus-visible) {
	outline: none;
}

.kt-question-prompt {
	font-family: var(--fonts-academy-display);
	font-size: 1.25rem;
	font-weight: 600;
	line-height: 1.35;
	color: var(--colors-academy-text);
}

.kt-question-prompt :deep(p) {
	margin: 0;
}

.kt-question-prompt :deep(p + p) {
	margin-top: 0.5rem;
}

.kt-question-prompt :deep(code) {
	font-family: var(--fonts-academy-mono);
	font-size: 0.9em;
}

.kt-question-hint {
	margin: -0.5rem 0 0;
	font-family: var(--fonts-academy-mono);
	font-size: 0.8125rem;
	color: var(--colors-academy-text-muted);
}

.kt-question-form {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 1rem;
}

.kt-question-form > div {
	width: 100%;
}

.kt-choices {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
}

.kt-choices--inline {
	flex-direction: row;
	flex-wrap: wrap;
}

.kt-choices--inline .kt-choice {
	flex: 1 1 10rem;
}

.kt-choice {
	position: relative;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.5rem 0.75rem;
	min-height: 2.75rem;
	padding: 0.75rem 1rem;
	border: 1px solid var(--colors-academy-border);
	border-radius: 4px;
	background: var(--colors-academy-panel);
	color: var(--colors-academy-text);
	cursor: pointer;
	transition: border-color 150ms ease, background-color 150ms ease;
}

.kt-choice:hover:not([data-disabled]) {
	border-color: var(--colors-academy-text-muted);
}

.kt-choice[data-state="checked"] {
	border-color: var(--colors-academy-accent);
}

.kt-choice[data-focus-visible],
.kt-choice:has(:focus-visible) {
	outline: 2px solid var(--colors-academy-accent);
	outline-offset: 2px;
}

.kt-choice[data-disabled] {
	cursor: default;
}

.kt-choice[data-result="correct"],
.kt-choice[data-result="missed"] {
	border-color: var(--colors-academy-status-spruce);
	background: color-mix(in srgb, var(--colors-academy-status-spruce) 8%, var(--colors-academy-panel));
}

.kt-choice[data-result="incorrect"] {
	border-color: var(--colors-academy-status-rust);
	background: color-mix(in srgb, var(--colors-academy-status-rust) 8%, var(--colors-academy-panel));
}

.kt-choice-control {
	display: inline-flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	width: 1.125rem;
	height: 1.125rem;
	border: 1.5px solid var(--colors-academy-input-border);
	background: var(--colors-academy-input);
}

.kt-choice-control--radio {
	border-radius: 50%;
}

.kt-choice-control--radio[data-state="checked"] {
	border-color: var(--colors-academy-accent);
	box-shadow: inset 0 0 0 3.5px var(--colors-academy-input);
	background: var(--colors-academy-accent);
}

.kt-choice-control--checkbox {
	border-radius: 3px;
}

.kt-choice-control--checkbox[data-state="checked"] {
	border-color: var(--colors-academy-accent);
	background: var(--colors-academy-accent);
	color: var(--colors-academy-accent-foreground);
}

.kt-choice-indicator {
	font-size: 0.75rem;
	line-height: 1;
}

.kt-choice-text {
	flex: 1 1 12rem;
	font-size: 1rem;
	line-height: 1.45;
}

.kt-choice-note {
	font-family: var(--fonts-academy-mono);
	font-size: 0.75rem;
	color: var(--colors-academy-text-soft);
}

.kt-question-error {
	margin: 0;
	font-size: 0.875rem;
	color: var(--colors-academy-status-rust);
}

.kt-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 2.75rem;
	padding: 0.625rem 1.25rem;
	border-radius: 4px;
	font-size: 0.9375rem;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 150ms ease;
}

.kt-button--primary {
	border: 1px solid var(--colors-academy-accent);
	background: var(--colors-academy-accent);
	color: var(--colors-academy-accent-foreground);
}

.kt-button--primary:hover {
	opacity: 0.9;
}

.kt-feedback {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 1rem 1.25rem;
	border: 1px solid var(--colors-academy-border);
	border-left: 3px solid var(--colors-academy-status-rust);
	border-radius: 4px;
	background: var(--colors-academy-panel);
}

.kt-feedback[data-correct="true"] {
	border-left-color: var(--colors-academy-status-spruce);
}

.kt-feedback-heading {
	margin: 0;
	font-family: var(--fonts-academy-display);
	font-size: 1.125rem;
	font-weight: 700;
	color: var(--colors-academy-text);
}

.kt-feedback-explanation {
	font-size: 0.9375rem;
	line-height: 1.6;
	color: var(--colors-academy-text-soft);
}

.kt-feedback-explanation :deep(p) {
	margin: 0;
}

.kt-feedback-explanation :deep(p + p) {
	margin-top: 0.5rem;
}

.kt-feedback-explanation :deep(code) {
	font-family: var(--fonts-academy-mono);
	font-size: 0.9em;
}

.kt-feedback-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem 1rem;
}

.kt-feedback-review {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	min-height: 2.75rem;
	font-weight: 600;
	color: var(--colors-academy-text);
	text-decoration: underline;
	text-decoration-color: var(--colors-academy-border);
	text-underline-offset: 0.2em;
}

.kt-feedback-review:hover {
	text-decoration-color: currentColor;
}
</style>
