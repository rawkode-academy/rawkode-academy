<script setup lang="ts">
import { ref } from "vue";
import { actions } from "astro:actions";

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
		error.value = err.message || "Connection failed";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div class="relative group">
		<!-- Success State -->
		<div v-if="isSuccess" class="flex items-center gap-3 text-green-500 tracking-wide">
			<span class="relative flex h-3 w-3">
			  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
			  <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
			</span>
			<span>Thanks for subscribing!</span>
		</div>
		
		<!-- Error State -->
		<div v-else-if="error" class="flex flex-col gap-2">
			<button 
				@click="subscribe"
				class="w-full relative overflow-hidden bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 py-3 px-6 rounded transition-all duration-300 text-sm group-hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
			>
				<span class="relative z-10 flex items-center justify-center gap-2">
					<span>Try again</span>
				</span>
			</button>
			<span class="text-xs text-red-400 text-center">Error: {{ error }}</span>
		</div>

		<!-- Idle / Loading State -->
		<button
			v-else
			@click="subscribe"
			:disabled="isLoading"
			data-faro-user-action-name="newsletter_subscribe"
			class="w-full relative overflow-hidden py-3 px-6 rounded border transition-all duration-300 text-sm min-w-[200px]"
			:class="[
				isLoading 
					? 'bg-primary/10 border-primary/30 text-primary cursor-wait' 
					: 'bg-white/5 dark:bg-white/5 hover:bg-primary hover:border-primary border-white/20 dark:border-white/10 text-gray-900 dark:text-white hover:text-white hover:shadow-[0_0_20px_rgba(var(--brand-primary),0.4)]'
			]"
		>
			<!-- Background Scanline Effect on Hover -->
			<div class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] -translate-x-[100%] group-hover:animate-[shimmer_1s_infinite]" v-if="!isLoading"></div>

			<span class="relative z-10 flex items-center justify-center gap-3">
				<template v-if="isLoading">
					<span class="animate-pulse">Subscribing...</span>
					<span class="flex gap-0.5">
						<span class="w-1 h-1 bg-primary rounded-full animate-[bounce_1s_infinite_0ms]"></span>
						<span class="w-1 h-1 bg-primary rounded-full animate-[bounce_1s_infinite_200ms]"></span>
						<span class="w-1 h-1 bg-primary rounded-full animate-[bounce_1s_infinite_400ms]"></span>
					</span>
				</template>
				<template v-else>
					<span>Subscribe for Updates!</span>
				</template>
			</span>
		</button>
	</div>
</template>

<style scoped>
@keyframes shimmer {
	100% {
		transform: translateX(100%);
	}
}
</style>

