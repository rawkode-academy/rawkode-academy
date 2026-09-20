<template>
	<div :class="s.root">
		<div :class="s.stack">
			<div v-for="(author, index) in displayAuthors" :key="author.id"
				:class="s.item" :style="{ zIndex: displayAuthors.length - index }">
				<img v-if="author.data.avatarUrl && !failedAvatars.has(author.id)"
					:class="s.avatar" :src="author.data.avatarUrl"
					:alt="`Profile picture of ${author.data.name}`" width="40" height="40" loading="lazy"
					@error="failedAvatars.add(author.id)" />
				<span v-else :class="[s.avatar, s.initials]" role="img" :aria-label="author.data.name">
					{{ initials(author.data.name) }}
				</span>
				<span v-if="showActiveIndicator && index === 0" :class="s.indicator" role="img"
					:aria-label="`${author.data.name}: ${activeIndicatorLabel}`"
					:title="`${author.data.name}: ${activeIndicatorLabel}`" />
			</div>
			<span v-if="remainingCount > 0" :class="[s.avatar, s.overflow]" role="img"
				:aria-label="`${remainingCount} additional ${remainingCount === 1 ? 'author' : 'authors'}: ${remainingNames}`">
				+{{ remainingCount }}
			</span>
		</div>
		<div v-if="showNames" :class="s.names">{{ authorNames }}</div>
	</div>
</template>

<script setup lang="ts">
import type { CollectionEntry } from "astro:content";
import { computed, reactive } from "vue";
import { academyAuthorGroup } from "@rawkodeacademy/design-system";

interface Props {
	authors: CollectionEntry<"people">[];
	maxDisplay?: number;
	showNames?: boolean;
	/** Opt in only when the caller has actual activity data for the first author. */
	showActiveIndicator?: boolean;
	activeIndicatorLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
	maxDisplay: 3,
	showNames: true,
	showActiveIndicator: false,
	activeIndicatorLabel: "Currently active",
});

const s = academyAuthorGroup();
const failedAvatars = reactive(new Set<string>());
const displayLimit = computed(() => Number.isFinite(props.maxDisplay) ? Math.max(0, Math.floor(props.maxDisplay)) : 3);
const displayAuthors = computed(() => props.authors.slice(0, displayLimit.value));
const remainingCount = computed(() => props.authors.length - displayAuthors.value.length);
const remainingNames = computed(() => props.authors.slice(displayLimit.value).map(author => author.data.name).join(", "));
const authorNames = computed(() => props.authors.map(author => author.data.name).join(", "));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? "").join("").toLocaleUpperCase();
</script>
