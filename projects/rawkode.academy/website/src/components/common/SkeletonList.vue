<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-for="index in items"
			:key="index"
			class="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
		>
			<!-- Icon/Avatar skeleton -->
			<div
				v-if="showIcon"
				:class="[
					'animate-pulse bg-gray-200 dark:bg-gray-700 shrink-0',
					iconRounded ? 'rounded-full' : 'rounded',
				]"
				:style="{
					width: iconSize,
					height: iconSize,
				}"
			/>

			<!-- Content -->
			<div class="flex-1">
				<!-- Title -->
				<div
					class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 mb-1"
					:style="{ width: getTitleWidth(index) }"
				/>
				<!-- Subtitle -->
				<div
					v-if="showSubtitle"
					class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3"
					:style="{ width: getSubtitleWidth(index) }"
				/>
			</div>

			<!-- Action skeleton -->
			<div
				v-if="showAction"
				class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded shrink-0"
				:style="{
					width: '1.5rem',
					height: '1.5rem',
				}"
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

const props = withDefaults(defineProps<Props>(), {
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
	return widths[index % widths.length] || "70%";
};

const getSubtitleWidth = (index: number): string => {
	const widths = ["50%", "40%", "55%", "45%", "60%"];
	return widths[index % widths.length] || "50%";
};
</script>