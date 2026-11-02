<script setup lang="ts">
import { computed, ref } from "vue";
import { KUBETRACK_EVENTS, track } from "@/lib/kubetrack/analytics";
import { band, type QuizResults, shareText } from "@/lib/kubetrack/quiz";
import { STAGE_ORDER, stageGlyph, stageLabel } from "@/lib/kubetrack/version";
import type { QuizQuestionProps } from "@/lib/kubetrack/view-model";

const props = defineProps<{
	releaseId: string;
	questions: QuizQuestionProps[];
	results: QuizResults;
	shareUrl: string;
}>();

const emit = defineEmits<{
	retryMissed: [];
	restart: [];
}>();

const heading = ref<HTMLElement | null>(null);
const shareStatus = ref("");
const manualText = ref<string | null>(null);

const resultBand = computed(() => band(props.results.percent));
const stages = computed(() =>
	STAGE_ORDER.flatMap((stage) => {
		const bucket = props.results.byStage[stage];
		return bucket ? [{ stage, ...bucket }] : [];
	}),
);
const missed = computed(() => {
	const wrong = new Set(
		props.results.perQuestion
			.filter((result) => !result.correct)
			.map((result) => result.id),
	);
	return props.questions.flatMap((question, index) =>
		wrong.has(question.id) ? [{ question, number: index + 1 }] : [],
	);
});
const text = computed(() =>
	shareText({ id: props.releaseId, url: props.shareUrl }, props.results),
);

async function share() {
	manualText.value = null;
	if (typeof navigator.share === "function") {
		try {
			await navigator.share({ text: text.value });
			shareStatus.value = "Shared.";
			track(KUBETRACK_EVENTS.RESULT_SHARED, {
				release: props.releaseId,
				method: "native",
			});
			return;
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
		}
	}
	try {
		await navigator.clipboard.writeText(text.value);
		shareStatus.value = "Result copied to the clipboard.";
		track(KUBETRACK_EVENTS.RESULT_SHARED, {
			release: props.releaseId,
			method: "clipboard",
		});
	} catch {
		manualText.value = text.value;
		shareStatus.value = "Copy your result from the box below.";
	}
}

function reviewCard(question: QuizQuestionProps) {
	const match = /^kep-(\d+)$/.exec(question.featureSlug ?? "");
	track(KUBETRACK_EVENTS.REVIEW_CARD_CLICKED, {
		release: props.releaseId,
		questionId: question.id,
		kep: match ? Number(match[1]) : undefined,
	});
}

defineExpose({
	focusHeading: () => heading.value?.focus(),
});
</script>

<template>
	<section class="kt-results" aria-labelledby="kt-results-heading">
		<div class="kt-results-score">
			<h3 id="kt-results-heading" ref="heading" class="kt-results-heading" tabindex="-1">
				You scored {{ results.correct }} of {{ results.total }}
			</h3>
			<p class="kt-results-band">
				{{ resultBand }} <span class="kt-results-percent">{{ results.percent }}%</span>
			</p>
		</div>

		<div v-if="stages.length > 0" class="kt-results-group">
			<h4 class="kt-results-subheading">By stage</h4>
			<ul class="kt-results-stages">
				<li v-for="item in stages" :key="item.stage" class="kt-results-stage">
					<span
						class="kt-results-glyph"
						:style="{ color: `var(--kubetrack-stage-${item.stage})` }"
						aria-hidden="true"
					>{{ stageGlyph(item.stage) }}</span>
					<span class="kt-results-stage-label">{{ stageLabel(item.stage) }}</span>
					<span class="kt-results-stage-count">{{ item.correct }} of {{ item.total }}</span>
				</li>
			</ul>
		</div>

		<div v-if="missed.length > 0" class="kt-results-group">
			<h4 class="kt-results-subheading">Worth another look</h4>
			<ol class="kt-results-missed">
				<li v-for="{ question, number } in missed" :key="question.id" class="kt-results-missed-item">
					<span class="kt-results-missed-number">Question {{ number }}</span>
					<!-- eslint-disable-next-line vue/no-v-html -- server-rendered rich text -->
					<div class="kt-results-missed-prompt" v-html="question.promptHtml" />
					<a
						v-if="question.featureSlug"
						class="kt-results-link"
						:href="`#${question.featureSlug}`"
						@click="reviewCard(question)"
					>
						Review card <span aria-hidden="true">→</span>
					</a>
				</li>
			</ol>
		</div>
		<p v-else class="kt-results-perfect">Every answer correct. You know this release.</p>

		<div class="kt-results-actions">
			<button
				v-if="missed.length > 0"
				type="button"
				class="kt-button kt-button--primary"
				@click="emit('retryMissed')"
			>
				Retry {{ missed.length }} missed
			</button>
			<button type="button" class="kt-button" @click="emit('restart')">Start again</button>
			<button type="button" class="kt-button" @click="share">Share result</button>
		</div>
		<p class="kt-results-share-status" role="status">{{ shareStatus }}</p>
		<textarea
			v-if="manualText"
			class="kt-results-manual"
			readonly
			rows="3"
			aria-label="Your result"
			:value="manualText"
		/>
	</section>
</template>

<style scoped>
.kt-results {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.kt-results-score {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.kt-results-heading {
	margin: 0;
	font-family: var(--fonts-academy-display);
	font-size: 2rem;
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	line-height: 1.1;
	color: var(--colors-academy-text);
}

.kt-results-heading:focus-visible {
	outline: 2px solid var(--colors-academy-accent);
	outline-offset: 4px;
	border-radius: 3px;
}

.kt-results-heading:focus:not(:focus-visible) {
	outline: none;
}

.kt-results-band {
	margin: 0;
	font-size: 1.0625rem;
	font-weight: 600;
	color: var(--colors-academy-text-soft);
}

.kt-results-percent {
	font-family: var(--fonts-academy-mono);
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--colors-academy-text-muted);
}

.kt-results-group {
	display: flex;
	flex-direction: column;
	gap: 0.625rem;
}

.kt-results-subheading {
	margin: 0;
	font-family: var(--fonts-academy-display);
	font-size: 1rem;
	font-weight: 700;
	color: var(--colors-academy-text);
}

.kt-results-stages {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	gap: 0.5rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.kt-results-stage {
	display: flex;
	align-items: baseline;
	gap: 0.5rem;
	padding: 0.625rem 0.75rem;
	border: 1px solid var(--colors-academy-border);
	border-radius: 4px;
	background: var(--colors-academy-panel);
}

.kt-results-glyph {
	font-size: 0.875rem;
}

.kt-results-stage-label {
	flex: 1;
	font-size: 0.9375rem;
	color: var(--colors-academy-text);
}

.kt-results-stage-count {
	font-family: var(--fonts-academy-mono);
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
	color: var(--colors-academy-text-soft);
}

.kt-results-missed {
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	list-style: none;
}

.kt-results-missed-item {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.75rem 0;
	border-top: 1px solid var(--colors-academy-border);
}

.kt-results-missed-item:last-child {
	border-bottom: 1px solid var(--colors-academy-border);
}

.kt-results-missed-number {
	font-family: var(--fonts-academy-mono);
	font-size: 0.75rem;
	color: var(--colors-academy-text-muted);
}

.kt-results-missed-prompt {
	font-size: 0.9375rem;
	line-height: 1.5;
	color: var(--colors-academy-text);
}

.kt-results-missed-prompt :deep(p) {
	margin: 0;
}

.kt-results-link {
	align-self: flex-start;
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	min-height: 2.75rem;
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--colors-academy-text);
	text-decoration: underline;
	text-decoration-color: var(--colors-academy-border);
	text-underline-offset: 0.2em;
}

.kt-results-link:hover {
	text-decoration-color: currentColor;
}

.kt-results-perfect {
	margin: 0;
	font-size: 1rem;
	color: var(--colors-academy-text-soft);
}

.kt-results-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.75rem;
}

.kt-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 2.75rem;
	padding: 0.625rem 1.25rem;
	border: 1px solid var(--colors-academy-border);
	border-radius: 4px;
	background: var(--colors-academy-panel);
	color: var(--colors-academy-text);
	font-size: 0.9375rem;
	font-weight: 600;
	cursor: pointer;
	transition: border-color 150ms ease, opacity 150ms ease;
}

.kt-button:hover {
	border-color: var(--colors-academy-text-muted);
}

.kt-button--primary {
	border-color: var(--colors-academy-accent);
	background: var(--colors-academy-accent);
	color: var(--colors-academy-accent-foreground);
}

.kt-button--primary:hover {
	border-color: var(--colors-academy-accent);
	opacity: 0.9;
}

.kt-results-share-status {
	margin: -0.75rem 0 0;
	min-height: 1.25rem;
	font-size: 0.875rem;
	color: var(--colors-academy-text-soft);
}

.kt-results-share-status:empty {
	min-height: 0;
}

.kt-results-manual {
	width: 100%;
	padding: 0.75rem;
	border: 1px solid var(--colors-academy-input-border);
	border-radius: 4px;
	background: var(--colors-academy-input);
	color: var(--colors-academy-text);
	font-family: var(--fonts-academy-mono);
	font-size: 0.875rem;
	resize: vertical;
}
</style>
