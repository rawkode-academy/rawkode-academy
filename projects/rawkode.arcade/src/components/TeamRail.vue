<script setup lang="ts">
import type { TeamScore } from "@/lib/live-contract";
import { scoreboard, visuallyHidden } from "@/styles/arcade";

const props = defineProps<{
	teams: readonly TeamScore[];
	compact?: boolean;
}>();

/**
 * The lead is marked by a surface tint, an amber score and an explicit LEAD
 * flag. Colour is never the only carrier of state.
 */
function slots(index: number) {
	return scoreboard({
		position: index === 0 ? "leading" : "default",
		density: props.compact ? "compact" : "base",
	});
}
</script>

<template>
	<section
		:class="slots(1).root"
		aria-label="Live team scores"
		data-testid="team-roster"
		aria-live="polite"
	>
		<div
			v-for="(team, index) in props.teams"
			:key="team.id"
			:class="slots(index).row"
		>
			<span :class="slots(index).rank">{{ index + 1 }}</span>
			<span :class="slots(index).identity">
				<span :class="slots(index).name">{{ team.name }}</span>
				<span v-if="index === 0" :class="slots(index).flag">Lead</span>
				<span v-if="team.streak" :class="slots(index).delta">
					{{ team.streak }}<span :class="visuallyHidden">answer</span>&times; streak
				</span>
			</span>
			<span :class="slots(index).score" :data-testid="`score-${team.id}`">
				{{ team.score.toLocaleString("en-GB") }}
			</span>
		</div>
	</section>
</template>
