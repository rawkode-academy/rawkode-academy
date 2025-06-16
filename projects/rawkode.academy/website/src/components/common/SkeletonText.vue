<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-for="(line, index) in lines"
			:key="index"
			:class="[
				'animate-pulse bg-gray-200 dark:bg-gray-700',
				index < lines.length - 1 ? 'mb-2' : '',
			]"
			:style="{
				height: lineHeight,
				width: getLineWidth(index),
				borderRadius: '0.25rem',
			}"
		/>
	</div>
</template>

<script setup lang="ts">
interface Props {
	lines?: number;
	lineHeight?: string;
	lastLineWidth?: string;
	className?: string;
	ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
	lines: 3,
	lineHeight: "1rem",
	lastLineWidth: "60%",
	className: "",
	ariaLabel: "Loading text content...",
});

const getLineWidth = (index: number): string => {
	if (index === props.lines - 1) {
		return props.lastLineWidth;
	}
	return "100%";
};
</script>