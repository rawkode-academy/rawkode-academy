<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-for="index in items"
			:key="index"
			class="flex items-center gap-3 border-b border-surface p-3 last:border-b-0"
		>
			<div
				v-if="showIcon"
				class="shrink-0 animate-pulse bg-[var(--surface-skeleton)]"
				:class="[iconRounded ? 'rounded-full' : 'rounded']"
				:style="{ width: iconSize, height: iconSize }"
			/>
			<div class="flex-1">
				<div
					class="mb-1 h-4 animate-pulse rounded bg-[var(--surface-skeleton)]"
					:style="{ width: getTitleWidth(index) }"
				/>
				<div
					v-if="showSubtitle"
					class="h-3 animate-pulse rounded bg-[var(--surface-skeleton)]"
					:style="{ width: getSubtitleWidth(index) }"
				/>
			</div>
			<div
				v-if="showAction"
				class="h-6 w-6 shrink-0 animate-pulse rounded bg-[var(--surface-skeleton)]"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
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

const getTitleWidth = (index: number): string => {
	const widths = ["70%", "85%", "60%", "75%", "65%"];
	return widths[(index - 1) % widths.length] || "70%";
};

const getSubtitleWidth = (index: number): string => {
	const widths = ["50%", "65%", "45%", "55%", "60%"];
	return widths[(index - 1) % widths.length] || "50%";
};
</script>
