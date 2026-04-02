<template>
	<div
		:class="[
			'flex flex-col items-center justify-center p-8',
			centered ? 'min-h-[400px]' : '',
		]"
	>
		<div
			:class="[
				'rounded-lg p-6 w-full',
				variant === 'error'
					? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
					: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
				maxWidth,
			]"
		>
			<!-- Icon -->
			<div v-if="showIcon" class="flex justify-center mb-4">
				<svg
					v-if="variant === 'error'"
					class="w-12 h-12 text-red-500 dark:text-red-400"
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
					class="w-12 h-12 text-yellow-500 dark:text-yellow-400"
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
				:class="[
					'text-lg font-semibold mb-2 text-center',
					variant === 'error'
						? 'text-red-800 dark:text-red-200'
						: 'text-yellow-800 dark:text-yellow-200',
				]"
			>
				{{ title }}
			</h3>

			<!-- Message -->
			<p
				:class="[
					'text-sm mb-4 text-center',
					variant === 'error'
						? 'text-red-700 dark:text-red-300'
						: 'text-yellow-700 dark:text-yellow-300',
				]"
			>
				{{ message }}
			</p>

			<!-- Actions -->
			<div v-if="$slots.actions" class="flex justify-center gap-3">
				<slot name="actions" />
			</div>

			<!-- Default retry button -->
			<div v-else-if="onRetry" class="flex justify-center">
				<button
					@click="onRetry"
					:class="[
						'px-4 py-2 rounded-md text-sm font-medium transition-colors',
						variant === 'error'
							? 'bg-red-600 hover:bg-red-700 text-white'
							: 'bg-yellow-600 hover:bg-yellow-700 text-white',
					]"
				>
					{{ retryText }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
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