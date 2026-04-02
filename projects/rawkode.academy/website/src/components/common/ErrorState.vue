<template>
	<div
		:class="css({
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			p: '8',
			...(centered ? { minHeight: '400px' } : {}),
		})"
	>
		<div
			:class="css({
				borderRadius: 'lg',
				p: '6',
				width: 'full',
				maxWidth: maxWidth === 'max-w-md' ? 'md' : maxWidth === 'max-w-lg' ? 'lg' : 'md',
				border: '1px solid',
				...(variant === 'error'
					? {
							bg: { base: 'red.50', _dark: 'rgba(127, 29, 29, 0.2)' },
							borderColor: { base: 'red.200', _dark: 'red.800' },
						}
					: {
							bg: { base: 'yellow.50', _dark: 'rgba(113, 63, 18, 0.2)' },
							borderColor: { base: 'yellow.200', _dark: 'yellow.800' },
						}),
			})"
		>
			<!-- Icon -->
			<div
				v-if="showIcon"
				:class="css({ display: 'flex', justifyContent: 'center', mb: '4' })"
			>
				<svg
					v-if="variant === 'error'"
					:class="css({ width: '12', height: '12', color: { base: 'red.500', _dark: 'red.400' } })"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<svg
					v-else
					:class="css({ width: '12', height: '12', color: { base: 'yellow.500', _dark: 'yellow.400' } })"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
			</div>

			<!-- Title -->
			<h3
				:class="css({
					fontSize: 'lg',
					fontWeight: 'semibold',
					mb: '2',
					textAlign: 'center',
					color: variant === 'error'
						? { base: 'red.800', _dark: 'red.200' }
						: { base: 'yellow.800', _dark: 'yellow.200' },
				})"
			>
				{{ title }}
			</h3>

			<!-- Message -->
			<p
				:class="css({
					fontSize: 'sm',
					mb: '4',
					textAlign: 'center',
					color: variant === 'error'
						? { base: 'red.700', _dark: 'red.300' }
						: { base: 'yellow.700', _dark: 'yellow.300' },
				})"
			>
				{{ message }}
			</p>

			<!-- Actions -->
			<div
				v-if="$slots.actions"
				:class="css({ display: 'flex', justifyContent: 'center', gap: '3' })"
			>
				<slot name="actions" />
			</div>

			<!-- Default retry button -->
			<div
				v-else-if="onRetry"
				:class="css({ display: 'flex', justifyContent: 'center' })"
			>
				<button
					@click="onRetry"
					:class="css({
						px: '4',
						py: '2',
						borderRadius: 'md',
						fontSize: 'sm',
						fontWeight: 'medium',
						transition: 'colors',
						transitionDuration: '200ms',
						color: 'white',
						bg: variant === 'error' ? 'red.600' : 'yellow.600',
						_hover: {
							bg: variant === 'error' ? 'red.700' : 'yellow.700',
						},
					})"
				>
					{{ retryText }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { css } from "styled-system/css";

interface Props {
	variant?: "error" | "warning";
	title?: string;
	message?: string;
	showIcon?: boolean;
	centered?: boolean;
	maxWidth?: string;
	onRetry?: () => void;
	retryText?: string;
}

withDefaults(defineProps<Props>(), {
	variant: "error",
	title: "Something went wrong",
	message: "An unexpected error occurred. Please try again.",
	showIcon: true,
	centered: true,
	maxWidth: "max-w-md",
	retryText: "Try again",
});
</script>
