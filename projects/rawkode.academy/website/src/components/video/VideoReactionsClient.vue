<script setup lang="ts">
import { Popover } from "@ark-ui/vue/popover";
import { actions } from "astro:actions";
import { reactive, ref } from "vue";
import { academyWatch } from "@rawkodeacademy/design-system";

const props = defineProps<{ videoId: string; initialCounts: Record<string, number> }>();
const watch = academyWatch();
const counts = reactive({ ...props.initialCounts });
const pressed = reactive<Record<string, boolean>>({});
const pickerOpen = ref(false);
const reactionButtonClass = (emoji: string) =>
	academyWatch({ pressed: Boolean(pressed[emoji]) }).reactionButton;
const reactionCountClass = (emoji: string) =>
	academyWatch({ pressed: Boolean(pressed[emoji]) }).reactionCount;
const defaultReactions = [
	{ emoji: "👍", label: "Like" },
	{ emoji: "👏", label: "Applause" },
	{ emoji: "🚀", label: "Rocket" },
	{ emoji: "💡", label: "Insightful" },
];
// A count appears once someone has reacted; a row of zeros reads as unfinished.
const reactionLabel = (reaction: { emoji: string; label: string }) => {
	const count = counts[reaction.emoji] ?? 0;
	if (count === 0) return reaction.label;
	return `${reaction.label}, ${count} ${count === 1 ? "reaction" : "reactions"}`;
};
const extraEmojis = ["😊", "😍", "🤔", "😎", "🙌", "💯", "🎉", "💪", "🤯", "🤩", "😂", "🤝", "👀", "🧠"];

const react = async (emoji: string) => {
	const previous = counts[emoji] ?? 0;
	counts[emoji] = previous + 1;
	pressed[emoji] = true;
	pickerOpen.value = false;

	let contentTimestamp = 0;
	const video = document.querySelector("media-player video") as HTMLVideoElement | null;
	if (video?.currentTime) contentTimestamp = Math.floor(video.currentTime);

	try {
		const { error } = await actions.addReaction({ contentId: props.videoId, emoji, contentTimestamp });
		if (!error) return;
		counts[emoji] = previous;
		pressed[emoji] = false;
		if (error.code === "UNAUTHORIZED") {
			window.location.href = `/api/auth/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`;
		}
	} catch {
		counts[emoji] = previous;
		pressed[emoji] = false;
	}
};
</script>

<template>
	<div :class="watch.reactions">
		<div :class="watch.reactionList" role="group" aria-label="React to this video">
			<button
				v-for="reaction in defaultReactions"
				:key="reaction.emoji"
				type="button"
				:class="reactionButtonClass(reaction.emoji)"
				:aria-label="reactionLabel(reaction)"
				:aria-pressed="Boolean(pressed[reaction.emoji])"
				@click="react(reaction.emoji)"
			>
				<span :class="watch.reactionEmoji">{{ reaction.emoji }}</span>
				<span v-if="counts[reaction.emoji]" :class="reactionCountClass(reaction.emoji)">{{ counts[reaction.emoji] }}</span>
			</button>

			<Popover.Root
				v-model:open="pickerOpen"
				:lazy-mount="true"
				:unmount-on-exit="true"
				:portalled="false"
				:positioning="{ placement: 'bottom-end', gutter: 8 }"
			>
				<Popover.Trigger :class="watch.reactionButton" aria-label="React with another emoji">+</Popover.Trigger>
				<Popover.Positioner>
					<Popover.Content :class="watch.reactionPicker">
						<Popover.Arrow><Popover.ArrowTip /></Popover.Arrow>
						<button v-for="emoji in extraEmojis" :key="emoji" type="button" :class="watch.emojiOption" :aria-label="`React with ${emoji}`" @click="react(emoji)">{{ emoji }}</button>
					</Popover.Content>
				</Popover.Positioner>
			</Popover.Root>
		</div>
	</div>
</template>
