<script setup lang="ts">
import { RadioGroup } from "@ark-ui/vue/radio-group";
import { computed, ref, watch } from "vue";
import type { PublicPrompt } from "@/lib/live-contract";
import { arcadeCard, arcadeControl } from "@/styles/arcade";

const props = defineProps<{
	prompt?: PublicPrompt;
	disabled?: boolean;
	allowMultiple?: boolean;
	/** Set only after the server acknowledges this participant's command. */
	submittedPromptId?: string;
	/** Prevents accidental double sends while the server decides the vote. */
	submitting?: boolean;
}>();
const emit = defineEmits<{
	answer: [input: { choiceId?: string; answer?: string }];
	reaction: [emoji: "🔥" | "🧠" | "⚡" | "🙌"];
}>();
const selected = ref("");
const answerText = ref("");
const choices = computed(() => props.prompt?.choices ?? []);
const reactions = ["🔥", "🧠", "⚡", "🙌"] as const;
const submitted = computed(
	() =>
		!props.allowMultiple &&
		Boolean(props.prompt?.id) &&
		props.submittedPromptId === props.prompt?.id,
);
const formDisabled = computed(
	() => Boolean(props.disabled || props.submitting || submitted.value),
);

watch(
	() => props.prompt?.id,
	() => {
		// A new authoritative prompt always starts a fresh ballot. This also
		// clears a rejected selection without leaking its previous answer.
		selected.value = "";
		answerText.value = "";
	},
);
function submit() {
	if ((selected.value || answerText.value.trim()) && props.prompt) {
		emit("answer", {
			choiceId: selected.value || undefined,
			answer: answerText.value.trim() || undefined,
		});
		if (props.allowMultiple) {
			selected.value = "";
			answerText.value = "";
		}
	}
}
</script>
<template>
	<section :class="[arcadeCard({ tone: 'live', padding: 'compact' }), 'audience-controls']" aria-label="Audience controls">
		<div class="eyebrow"><span>Audience play</span><b>One vote · live</b></div>
		<p v-if="prompt" class="question">{{ prompt.text }}</p>
		<RadioGroup.Root v-model="selected" :disabled="formDisabled" class="choices" aria-label="Select an answer">
			<RadioGroup.Item v-for="choice in choices" :key="choice.id" :value="choice.id" class="choice" :data-testid="`answer-option-${choice.id}`">
				<RadioGroup.ItemControl class="choice-control"><RadioGroup.ItemIndicator>✓</RadioGroup.ItemIndicator></RadioGroup.ItemControl>
				<RadioGroup.ItemText>{{ choice.label }}</RadioGroup.ItemText>
				<RadioGroup.ItemHiddenInput />
			</RadioGroup.Item>
		</RadioGroup.Root>
		<label class="free-answer" for="answer-input">Or enter an answer<input id="answer-input" v-model="answerText" data-testid="answer-input" :disabled="formDisabled" autocomplete="off" maxlength="100" /></label>
		<button :class="[arcadeControl({ tone: 'accent' }), 'submit']" data-testid="submit-answer" :disabled="(!selected && !answerText.trim()) || formDisabled" @click="submit">{{ submitted ? 'Answer locked in' : submitting ? 'Sending answer…' : 'Lock in answer' }} <span aria-hidden="true">↗</span></button>
		<div class="reactions" aria-label="Send a live reaction"><span>React</span><button v-for="emoji in reactions" :key="emoji" :aria-label="`Send ${emoji} reaction`" @click="emit('reaction', emoji)">{{ emoji }}</button></div>
	</section>
</template>
<style scoped>
.audience-controls { background: linear-gradient(145deg, rgb(24 38 74 / 88%), rgb(16 26 53 / 88%)); border: 1px solid rgb(77 232 255 / 28%); border-radius: 16px; box-shadow: var(--shadow); padding: 1rem; }.eyebrow { align-items: center; color: var(--cyan); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .66rem; justify-content: space-between; letter-spacing: .08em; text-transform: uppercase; }.eyebrow b { color: var(--mist); font-size: .57rem; font-weight: 500; }.question { font-family: "Space Grotesk", sans-serif; font-size: 1.05rem; font-weight: 600; letter-spacing: -.03em; line-height: 1.25; margin: .75rem 0 1rem; }.choices { display: grid; gap: .55rem; }.choice { align-items: center; background: rgb(8 13 29 / 42%); border: 1px solid var(--line); border-radius: 10px; display: grid; font-size: .83rem; gap: .65rem; grid-template-columns: 1rem 1fr; padding: .7rem; transition: background .14s ease, border-color .14s ease; }.choice[data-state='checked'] { background: rgb(77 232 255 / 11%); border-color: var(--cyan); }.choice-control { align-items: center; border: 1px solid var(--mist); border-radius: 50%; color: var(--ink); display: flex; font-size: .66rem; height: 16px; justify-content: center; width: 16px; }.choice[data-state='checked'] .choice-control { background: var(--cyan); border-color: var(--cyan); }.free-answer { color: var(--mist); display: grid; font-family: "IBM Plex Mono", monospace; font-size: .58rem; gap: .35rem; letter-spacing: .05em; margin-top: .8rem; text-transform: uppercase; }.free-answer input { background: rgb(8 13 29 / 42%); border: 1px solid var(--line); border-radius: 8px; color: var(--cloud); padding: .55rem; }.submit { background: var(--cyan); border: 0; border-radius: 9px; color: var(--ink); font-size: .83rem; font-weight: 800; margin-top: .8rem; padding: .75rem; width: 100%; }.submit:disabled { background: rgb(174 187 217 / 18%); color: var(--mist); cursor: not-allowed; }.reactions { align-items: center; border-top: 1px solid var(--line); display: flex; gap: .4rem; margin-top: .9rem; padding-top: .75rem; }.reactions span { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .58rem; letter-spacing: .07em; margin-right: auto; text-transform: uppercase; }.reactions button { background: rgb(174 187 217 / 8%); border: 1px solid var(--line); border-radius: 7px; font-size: .88rem; padding: .24rem .38rem; }
</style>
