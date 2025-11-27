<script setup lang="ts">
import { ref } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSubscribed: boolean;
}>();

const subscribed = ref(props.isSubscribed);
const isLoading = ref(false);
const error = ref<string | null>(null);
const showSuccess = ref(false);

const toggleSubscription = async () => {
	if (isLoading.value) return;

	isLoading.value = true;
	error.value = null;
	showSuccess.value = false;

	try {
		if (subscribed.value) {
			const { error: actionError } = await actions.newsletter.unsubscribe({
				source: "settings-page",
			});
			if (actionError) throw new Error(actionError.message);
			subscribed.value = false;
		} else {
			const { error: actionError } = await actions.newsletter.subscribe({
				source: "settings-page",
			});
			if (actionError) throw new Error(actionError.message);
			subscribed.value = true;
		}
		showSuccess.value = true;
		setTimeout(() => {
			showSuccess.value = false;
		}, 3000);
	} catch (err: any) {
		error.value = err.message || "Failed to update preference";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div class="space-y-6">
		<div class="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800">
			<div class="flex-1 pr-4">
				<h3 class="text-base font-medium text-neutral-900 dark:text-white">
					Newsletter
				</h3>
				<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
					Receive updates about new courses, videos, articles, and cloud native content.
				</p>
			</div>
			<button
				type="button"
				:disabled="isLoading"
				@click="toggleSubscription"
				:class="[
					'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
					subscribed ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-700',
					isLoading ? 'opacity-50 cursor-wait' : ''
				]"
				role="switch"
				:aria-checked="subscribed"
			>
				<span class="sr-only">Toggle newsletter subscription</span>
				<span
					:class="[
						'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
						subscribed ? 'translate-x-5' : 'translate-x-0'
					]"
				/>
			</button>
		</div>

		<div
			v-if="showSuccess"
			class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm"
		>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			<span>Your preferences have been updated.</span>
		</div>

		<div
			v-if="error"
			class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
		>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{{ error }}</span>
		</div>
	</div>
</template>
