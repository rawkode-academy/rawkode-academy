<script setup lang="ts">
import { RadioGroup } from "@ark-ui/vue/radio-group";
import { computed, ref, watch } from "vue";
import type { PublicPrompt } from "@/lib/live-contract";
import { css } from "@/../styled-system/css";
import {
	choice,
	choiceKey,
	control,
	field,
	fieldLabel,
	slug,
	stage,
	text,
} from "@/styles/arcade";

const header = css({
	display: "flex",
	justifyContent: "space-between",
	gap: "3",
	pb: "3",
	mb: "4",
	borderBottomWidth: "hairline",
	borderBottomStyle: "solid",
	borderBottomColor: "rule",
});
const question = css({ mb: "4" });
const options = css({ display: "grid", gap: "2" });
const freeAnswer = css({ mt: "4" });
const submitButton = css({ mt: "4" });
const reactionRow = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
	mt: "4",
	pt: "3",
	borderTopWidth: "hairline",
	borderTopStyle: "solid",
	borderTopColor: "rule",
});
const reactionButton = css({
	minWidth: "touch",
	minHeight: "touch",
	borderRadius: "sm",
	borderWidth: "hairline",
	borderStyle: "solid",
	borderColor: "rule",
	bg: "transparent",
	fontSize: "body",
	transitionProperty: "colors",
	transitionDuration: "fast",
	transitionTimingFunction: "standard",
	_hover: { borderColor: "live", bg: "amberDim" },
});

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
/** Emoji need a text label; a screen reader cannot announce a pictograph usefully. */
const reactionLabels: Record<(typeof reactions)[number], string> = {
	"🔥": "fire",
	"🧠": "big brain",
	"⚡": "fast",
	"🙌": "applause",
};
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
	<section :class="stage({ tone: 'live', pad: 'base' })" data-stage aria-label="Audience controls">
		<div :class="header">
			<span :class="slug({ tone: 'live' })">Your ballot</span>
			<span :class="slug()">{{ allowMultiple ? "Multiple answers" : "One answer" }}</span>
		</div>

		<p v-if="prompt" :class="[text({ style: 'body' }), question]">{{ prompt.text }}</p>

		<RadioGroup.Root
			v-model="selected"
			:disabled="formDisabled"
			:class="options"
			aria-label="Select an answer"
		>
			<RadioGroup.Item
				v-for="(item, index) in choices"
				:key="item.id"
				:value="item.id"
				:class="choice({ state: selected === item.id ? 'selected' : 'idle' })"
				:data-testid="`answer-option-${item.id}`"
			>
				<RadioGroup.ItemControl :class="choiceKey">
					{{ String.fromCharCode(65 + index) }}
				</RadioGroup.ItemControl>
				<RadioGroup.ItemText>{{ item.label }}</RadioGroup.ItemText>
				<RadioGroup.ItemHiddenInput />
			</RadioGroup.Item>
		</RadioGroup.Root>

		<div :class="freeAnswer">
			<label :class="fieldLabel" for="answer-input">Or type an answer</label>
			<input
				id="answer-input"
				v-model="answerText"
				:class="field()"
				data-testid="answer-input"
				data-field
				:disabled="formDisabled"
				autocomplete="off"
				maxlength="100"
			/>
		</div>

		<button
			:class="[control({ tone: 'live', size: 'block' }), submitButton]"
			type="button"
			data-testid="submit-answer"
			data-control
			:disabled="(!selected && !answerText.trim()) || formDisabled"
			@click="submit"
		>
			{{ submitted ? "Answer locked in" : submitting ? "Sending answer…" : "Lock in answer" }}
		</button>

		<div :class="reactionRow" aria-label="Send a live reaction">
			<span :class="slug()">React</span>
			<button
				v-for="emoji in reactions"
				:key="emoji"
				type="button"
				:class="reactionButton"
				:aria-label="`Send ${reactionLabels[emoji]} reaction`"
				@click="emit('reaction', emoji)"
			>
				{{ emoji }}
			</button>
		</div>
	</section>
</template>
