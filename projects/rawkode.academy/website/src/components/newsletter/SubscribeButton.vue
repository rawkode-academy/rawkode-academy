<script setup lang="ts">
import { ref } from "vue";
import { actions } from "astro:actions";
import Button from "@/components/common/Button.vue";

const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);

const subscribe = async () => {
	if (isLoading.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.newsletter.subscribe({
			source: "website-cta",
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			isSuccess.value = true;
		}
	} catch (err: any) {
		error.value = err.message || "An error occurred";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div>
		<div v-if="isSuccess" class="flex items-center text-green-600 dark:text-green-400 font-medium">
			<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
			</svg>
			Subscribed!
		</div>
		
		<div v-else>
			<Button 
				@click="subscribe" 
				:disabled="isLoading"
				variant="primary"
			>
				<template v-if="isLoading">
					<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Subscribing...
				</template>
				<template v-else>
					Subscribe for Updates
				</template>
			</Button>
			<p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">
				{{ error }}
			</p>
		</div>
	</div>
</template>
