<template>
	<div
		:class="css({
			display: 'flex',
			gap: '3',
			p: '4',
			borderBottom: '1px solid',
			borderColor: { base: 'gray.200', _dark: 'gray.700' },
		})"
		role="status"
		:aria-label="ariaLabel"
	>
		<span :class="css({ srOnly: true })">{{ ariaLabel }}</span>
		<!-- Avatar skeleton -->
		<div
			:class="css({
				animation: 'pulse',
				bg: { base: 'gray.200', _dark: 'gray.700' },
				borderRadius: 'full',
				flexShrink: '0',
			})"
			:style="{
				width: '2.5rem',
				height: '2.5rem',
			}"
		/>

		<!-- Comment content -->
		<div :class="css({ flex: '1' })">
			<!-- Header with author and timestamp -->
			<div :class="css({ display: 'flex', alignItems: 'center', gap: '2', mb: '2' })">
				<div
					:class="css({
						animation: 'pulse',
						bg: { base: 'gray.200', _dark: 'gray.700' },
						borderRadius: 'md',
						h: '4',
					})"
					style="width: 120px"
				/>
				<div
					:class="css({
						animation: 'pulse',
						bg: { base: 'gray.200', _dark: 'gray.700' },
						borderRadius: 'md',
						h: '3',
					})"
					style="width: 80px"
				/>
			</div>

			<!-- Comment text -->
			<SkeletonText
				:lines="lines"
				:line-height="'0.875rem'"
				:last-line-width="lastLineWidth"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { css } from "styled-system/css";
import SkeletonText from "./SkeletonText.vue";

interface Props {
	lines?: number;
	lastLineWidth?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	lines: 2,
	lastLineWidth: "70%",
	ariaLabel: "Loading comment...",
});
</script>
