<script setup lang="ts">
import { Popover } from "@ark-ui/vue/popover";
import { actions } from "astro:actions";
import { reactive, ref } from "vue";

const props = defineProps<{ videoId: string; initialCounts: Record<string, number> }>();
const counts = reactive({ ...props.initialCounts });
const pressed = reactive<Record<string, boolean>>({});
const pickerOpen = ref(false);
const defaultReactions = [
	{ emoji: "👍", label: "Like" },
	{ emoji: "👏", label: "Applause" },
	{ emoji: "🚀", label: "Rocket" },
	{ emoji: "💡", label: "Insightful" },
];
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
	<div class="paper-card p-3 sm:p-4">
		<div class="flex items-center gap-1.5 sm:gap-2 flex-wrap relative z-10">
			<button
				v-for="reaction in defaultReactions"
				:key="reaction.emoji"
				type="button"
				:class="['reaction-btn paper-card-muted flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary/50', { active: pressed[reaction.emoji] }]"
				:aria-label="`${reaction.label}, ${counts[reaction.emoji] || 0} reactions`"
				:aria-pressed="Boolean(pressed[reaction.emoji])"
				@click="react(reaction.emoji)"
			>
				<span class="text-base sm:text-xl">{{ reaction.emoji }}</span>
				<span class="count text-xs sm:text-sm font-medium text-secondary-content">{{ counts[reaction.emoji] || 0 }}</span>
			</button>

			<Popover.Root
				v-model:open="pickerOpen"
				:lazy-mount="true"
				:unmount-on-exit="true"
				:portalled="false"
				:positioning="{ placement: 'bottom-end', gutter: 8 }"
			>
				<Popover.Trigger class="reaction-btn paper-card-muted flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-2 !border-dashed !border-[var(--editorial-hairline-strong)]" aria-label="Add custom emoji">+</Popover.Trigger>
				<Popover.Positioner class="z-50">
					<Popover.Content class="emoji-picker p-2 sm:p-3 paper-card grid grid-cols-5 sm:grid-cols-7 gap-1 focus:outline-none">
						<Popover.Arrow><Popover.ArrowTip /></Popover.Arrow>
						<button v-for="emoji in extraEmojis" :key="emoji" type="button" class="emoji-option paper-card-muted p-1.5 sm:p-2 text-lg sm:text-2xl cursor-pointer" :aria-label="`React with ${emoji}`" @click="react(emoji)">{{ emoji }}</button>
					</Popover.Content>
				</Popover.Positioner>
			</Popover.Root>
		</div>
	</div>
</template>

<style scoped>
.reaction-btn.active { box-shadow: 0 0 0 2px rgb(var(--brand-primary) / 0.7); background: rgb(var(--brand-primary) / 0.3); }
.emoji-picker { width: min(22rem, calc(100vw - 2rem)); }
:global(html.dark) .reaction-btn.active { background: rgb(var(--brand-primary) / 0.2); }
</style>
