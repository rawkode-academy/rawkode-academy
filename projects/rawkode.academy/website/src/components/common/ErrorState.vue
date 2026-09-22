<template>
	<div
		:class="doc.empty"
		:style="centered ? { minHeight: '25rem' } : undefined"
	>
		<div
			:class="doc.notice"
			:style="{ width: '100%', maxWidth }"
			role="alert"
		>
			<!-- Icon -->
			<div v-if="showIcon">
				<svg
					v-if="variant === 'error'"
					:class="doc.iconLarge"
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
					:class="doc.iconLarge"
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
				:class="doc.cardTitle"
			>
				{{ title }}
			</h3>

			<!-- Message -->
			<p
				:class="doc.copy"
			>
				{{ message }}
			</p>

			<!-- Actions -->
			<div v-if="$slots.actions" :class="doc.actions">
				<slot name="actions" />
			</div>

			<!-- Default retry button -->
			<div v-else-if="onRetry" :class="doc.actions">
				<button
					@click="onRetry"
					:class="doc.button"
				>
					{{ retryText }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academyDocument } from "@rawkodeacademy/design-system";

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
	maxWidth: "28rem",
	retryText: "Try again",
});
const doc = academyDocument();
</script>
