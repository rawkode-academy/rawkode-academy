<style>
@reference "@/styles/global.css";

.connected {
	@apply border-blue-500 dark:border-blue-400;
}
</style>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800"
		:class="{ 'connected': showShareOptions }">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<!-- Reaction Buttons -->
			<div class="flex items-center gap-1 sm:gap-2">
				<button v-for="reaction in reactions" :key="reaction.emoji"
					:aria-label="`${reaction.label} (${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'})`"
					class="group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="handleReaction(reaction)">
					<span aria-hidden="true" class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">
						{{ reaction.emoji }}
					</span>
					<span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
						{{ reaction.count }}
					</span>
				</button>
			</div>

			<!-- Share and Save Options -->
			<div class="flex items-center gap-2">
				<button aria-label="Save this video for later"
					class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="handleSave">
					<svg aria-hidden="true" class="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
					</svg>
					<span class="text-xs sm:text-sm font-medium">Save</span>
				</button>
				<button aria-label="Share this video"
					:class="['flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors', { 'bg-blue-100 dark:bg-blue-900': showShareOptions }]"
					@click="handleShare">
					<svg aria-hidden="true" class="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z">
						</path>
					</svg>
					<span class="text-xs sm:text-sm font-medium">Share</span>
				</button>
			</div>
		</div>

		<!-- Share Options - Conditionally Rendered -->
		<transition name="slide-fade" enter-active-class="transition-all duration-300 ease-out"
			enter-from-class="opacity-0 -translate-y-2 max-h-0" enter-to-class="opacity-100 translate-y-0 max-h-[200px]"
			leave-active-class="transition-all duration-200 ease-in"
			leave-from-class="opacity-100 translate-y-0 max-h-[200px]" leave-to-class="opacity-0 -translate-y-2 max-h-0">
			<div v-if="showShareOptions" class="mt-4 overflow-hidden connected">
				<ShareButton :videoId="videoId" :videoTitle="videoTitle" :videoSlug="videoSlug" />
			</div>
		</transition>

		<!-- Coming Soon Banner -->
		<transition name="banner" enter-active-class="transition-all duration-300 ease-in-out"
			enter-from-class="opacity-0 translate-y-2" enter-to-class="opacity-100 translate-y-0"
			leave-active-class="transition-all duration-300 ease-in-out" leave-from-class="opacity-100 translate-y-0"
			leave-to-class="opacity-0 translate-y-2">
			<div v-if="showBanner"
				class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span class="text-sm font-medium">This feature is coming in a few days!</span>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import ShareButton from "./ShareButton.vue";

export default {
	components: {
		ShareButton,
	},
	props: {
		videoId: {
			type: String,
			required: true,
		},
		videoTitle: {
			type: String,
			required: true,
		},
		videoSlug: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			showBanner: false,
			bannerTimeout: null,
			showShareOptions: false, // New state for toggling ShareButton
			reactions: [
				{ emoji: "👍", label: "Like this video", count: 124 },
				{ emoji: "🚀", label: "Rocket reaction", count: 89 },
				{ emoji: "💡", label: "Insightful reaction", count: 45 },
			],
		};
	},
	methods: {
		handleReaction(reaction) {
			this.showComingSoonBanner();
			// TODO: Implement reaction logic when backend is ready
		},
		handleShare() {
			this.showShareOptions = !this.showShareOptions;
		},
		handleSave() {
			this.showComingSoonBanner();
			// TODO: Implement save functionality
		},
		showComingSoonBanner() {
			// Clear any existing timeout
			if (this.bannerTimeout) {
				clearTimeout(this.bannerTimeout);
			}

			// Show banner
			this.showBanner = true;

			// Hide after 3 seconds
			this.bannerTimeout = setTimeout(() => {
				this.showBanner = false;
			}, 3000);
		},
	},
	beforeUnmount() {
		if (this.bannerTimeout) {
			clearTimeout(this.bannerTimeout);
		}
	},
};
</script>

