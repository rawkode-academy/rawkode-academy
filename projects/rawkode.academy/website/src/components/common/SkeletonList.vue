<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-for="index in items"
			:key="index"
			:class="[skeleton.row, 'skeleton-list__row']"
		>
			<div
				v-if="showIcon"
				:class="iconRounded ? skeleton.avatar : skeleton.line"
				class="skeleton-list__fixed"
				:style="{ width: iconSize, height: iconSize }"
			/>
			<div :class="[skeleton.content, 'skeleton-list__copy']">
				<div
					:class="skeleton.lineMedium"
					:style="{ width: getTitleWidth(index) }"
				/>
				<div
					v-if="showSubtitle"
					:class="skeleton.lineSmall"
					:style="{ width: getSubtitleWidth(index) }"
				/>
			</div>
			<div
				v-if="showAction"
				:class="skeleton.line"
				class="skeleton-list__fixed skeleton-list__action"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academySkeleton } from "@rawkodeacademy/design-system";

interface Props {
	items?: number;
	showIcon?: boolean;
	iconSize?: string;
	iconRounded?: boolean;
	showSubtitle?: boolean;
	showAction?: boolean;
	className?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	items: 5,
	showIcon: true,
	iconSize: "2rem",
	iconRounded: false,
	showSubtitle: true,
	showAction: false,
	className: "",
	ariaLabel: "Loading list...",
});
const skeleton = academySkeleton();

const getTitleWidth = (index: number): string => {
	const widths = ["70%", "85%", "60%", "75%", "65%"];
	return widths[(index - 1) % widths.length] || "70%";
};

const getSubtitleWidth = (index: number): string => {
	const widths = ["50%", "65%", "45%", "55%", "60%"];
	return widths[(index - 1) % widths.length] || "50%";
};
</script>

<style scoped>
/* Layout only; the surfaces and pulse come from academySkeleton. */
.skeleton-list__row {
	align-items: center;
	padding: 0.75rem;
}

.skeleton-list__row:last-child {
	border-bottom: 0;
}

.skeleton-list__fixed {
	flex-shrink: 0;
}

.skeleton-list__copy {
	display: grid;
	gap: 0.25rem;
}

.skeleton-list__action {
	width: 1.5rem;
	height: 1.5rem;
}
</style>
