<style>
@reference "@/styles/global.css";

.connected {
	@apply border-blue-500 dark:border-blue-400;
}

/* Emoji Mart styling overrides for dark mode */
.emoji-mart {
	@apply !bg-white dark:!bg-gray-800 !border-gray-300 dark:!border-gray-600;
}

.emoji-mart-category-label span {
	@apply !text-gray-700 dark:!text-gray-300;
}

.emoji-mart-search input {
	@apply !bg-gray-50 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 !border-gray-300 dark:!border-gray-600;
}

.emoji-mart-search-icon {
	@apply !text-gray-500 dark:!text-gray-400;
}

.emoji-mart-bar {
	@apply !border-gray-300 dark:!border-gray-600;
}

.emoji-mart-anchors i {
	@apply !text-gray-600 dark:!text-gray-400;
}

.emoji-mart-anchor-selected .emoji-mart-anchor-bar {
	@apply !bg-blue-500;
}
</style>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800"
		:class="{ 'connected': showShareOptions }">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<!-- Reaction Buttons -->
			<div class="flex items-center gap-1 sm:gap-2">
				<button v-for="reaction in topReactions" :key="reaction.emoji"
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
				
				<!-- Emoji Picker Button -->
				<div class="relative">
					<button
						aria-label="Add custom emoji reaction"
						class="group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-2 border-dashed border-gray-300 dark:border-gray-600"
						@click="toggleEmojiPicker">
						<span aria-hidden="true" class="text-xl sm:text-2xl">
							➕
						</span>
						<span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
							Add
						</span>
					</button>
					
					<!-- Emoji Picker Dropdown -->
					<transition
						enter-active-class="transition ease-out duration-200"
						enter-from-class="transform opacity-0 scale-95"
						enter-to-class="transform opacity-100 scale-100"
						leave-active-class="transition ease-in duration-150"
						leave-from-class="transform opacity-100 scale-100"
						leave-to-class="transform opacity-0 scale-95">
						<div v-if="showEmojiPicker" 
							class="absolute z-50 mt-2 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5"
							:class="{ 'right-0': true }">
							<Picker
								:data="emojiIndex"
								set="native"
								:native="true"
								:show-preview="false"
								:show-skin-tones="false"
								:emoji-size="24"
								:per-line="8"
								:i18n="i18n"
								@select="onEmojiSelect"
							/>
						</div>
					</transition>
				</div>
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

		<!-- Banner Messages -->
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
					<span class="text-sm font-medium">{{ bannerMessage }}</span>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import { actions } from "astro:actions";
import ShareButton from "./ShareButton.vue";

export default {
	components: {
		ShareButton,
		Picker,
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
			bannerMessage: "",
			showShareOptions: false,
			reactions: [],
			userReactions: new Set(), // Track which emojis the current user has reacted with
			isAuthenticated: false,
			defaultButtonEmojis: ["👍", "❤️", "🚀", "🔥"], // Always show these 4 as buttons
			defaultEmojis: ["👍", "🚀", "💡", "❤️", "🔥", "👏"],
			loading: false,
			showEmojiPicker: false,
			emojiIndex: emojiIndex,
			i18n: {
				search: "Search",
				clear: "Clear",
				notfound: "No Emoji Found",
				skintext: "Choose your default skin tone",
				categories: {
					search: "Search Results",
					recent: "Frequently Used",
					people: "Smileys & People",
					nature: "Animals & Nature",
					foods: "Food & Drink",
					activity: "Activity",
					places: "Travel & Places",
					objects: "Objects",
					symbols: "Symbols",
					flags: "Flags",
					custom: "Custom",
				},
			},
			commonEmojis: [
				"😀",
				"😍",
				"🤣",
				"😊",
				"😎",
				"🤔",
				"👏",
				"🎉",
				"💯",
				"✨",
				"🙌",
				"💪",
				"🚀",
				"💡",
				"🔥",
				"⭐",
				"🌟",
				"🎯",
				"❤️",
				"💜",
				"💙",
				"💚",
				"🧡",
				"💛",
				"😮",
				"😲",
				"🤯",
				"🤩",
				"🥳",
				"🤗",
				"👍",
				"👎",
				"👌",
				"✌️",
				"🤝",
				"🙏",
				"😢",
				"😭",
				"😡",
				"🥰",
			],
		};
	},
	computed: {
		topReactions() {
			// Always show the 4 default button emojis
			return this.defaultButtonEmojis.map((emoji) => {
				const existing = this.reactions.find((r) => r.emoji === emoji);
				return (
					existing || {
						emoji,
						label: this.getEmojiLabel(emoji),
						count: 0,
					}
				);
			});
		},
		otherReactions() {
			// Return reactions that aren't in the default buttons but have counts > 0
			return this.reactions.filter(
				(r) => !this.defaultButtonEmojis.includes(r.emoji) && r.count > 0,
			);
		},
	},
	async mounted() {
		console.log("VideoReactions mounted with videoId:", this.videoId);
		// Check if user is authenticated
		await this.checkAuth();
		console.log("Auth check complete, isAuthenticated:", this.isAuthenticated);
		// Fetch reactions for this video
		await this.fetchReactions();
		console.log("Reactions fetched:", this.reactions);
		// Add click outside listener
		document.addEventListener("click", this.handleClickOutside);
	},
	beforeUnmount() {
		if (this.bannerTimeout) {
			clearTimeout(this.bannerTimeout);
		}
		document.removeEventListener("click", this.handleClickOutside);
	},
	methods: {
		async checkAuth() {
			try {
				const response = await fetch("/api/auth/me");
				this.isAuthenticated = response.ok;
			} catch (error) {
				console.error("Failed to check auth status:", error);
			}
		},
		async fetchReactions() {
			try {
				const query = `
					query GetVideoReactions($videoId: String!) {
						_entities(representations: [{ __typename: "Video", id: $videoId }]) {
							... on Video {
								id
								emojiReactions {
									emoji
									count
								}
							}
						}
					}
				`;

				const response = await fetch("https://api.rawkode.academy/graphql", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						query,
						variables: { videoId: this.videoId },
					}),
				});

				if (!response.ok) {
					throw new Error(`GraphQL request failed: ${response.status}`);
				}

				const data = await response.json();
				const videoEntity = data.data?._entities?.[0];

				if (videoEntity?.emojiReactions) {
					// Create reaction objects from the GraphQL response
					const reactionMap = new Map();

					// Initialize with all default emojis (not just button ones)
					for (const emoji of this.defaultEmojis) {
						reactionMap.set(emoji, {
							emoji,
							label: this.getEmojiLabel(emoji),
							count: 0,
						});
					}

					// Update counts from API
					for (const reaction of videoEntity.emojiReactions) {
						if (reactionMap.has(reaction.emoji)) {
							reactionMap.get(reaction.emoji).count = reaction.count;
						} else {
							// Add non-default emojis that have reactions
							reactionMap.set(reaction.emoji, {
								emoji: reaction.emoji,
								label: this.getEmojiLabel(reaction.emoji),
								count: reaction.count,
							});
						}
					}

					// Convert to array and sort by count
					this.reactions = Array.from(reactionMap.values()).sort(
						(a, b) => b.count - a.count,
					);
				}
			} catch (error) {
				console.error("Failed to fetch reactions:", error);
				// Fall back to default emojis with 0 counts
				this.reactions = this.defaultEmojis.map((emoji) => ({
					emoji,
					label: this.getEmojiLabel(emoji),
					count: 0,
				}));
			}
		},
		getEmojiLabel(emoji) {
			const labels = {
				"👍": "Like this video",
				"🚀": "Rocket reaction",
				"💡": "Insightful reaction",
				"❤️": "Love this video",
				"🔥": "Fire reaction",
				"👏": "Applause reaction",
			};
			return labels[emoji] || `React with ${emoji}`;
		},
		async handleReaction(reaction) {
			console.log("handleReaction called with:", reaction);
			console.log("isAuthenticated:", this.isAuthenticated);

			if (!this.isAuthenticated) {
				// Redirect to sign in
				window.location.href = "/api/auth/sign-in";
				return;
			}

			if (this.loading) return;
			this.loading = true;

			try {
				const { data, error } = await actions.addReaction({
					contentId: this.videoId,
					emoji: reaction.emoji,
				});

				if (error) {
					console.error("Failed to add reaction:", error);
					this.showErrorBanner("Failed to add reaction. Please try again.");
				} else {
					// Optimistically update the count
					reaction.count++;
					this.userReactions.add(reaction.emoji);

					// Refresh reactions from server after a short delay
					setTimeout(() => this.fetchReactions(), 1000);
				}
			} catch (error) {
				console.error("Failed to add reaction:", error);
				this.showErrorBanner("Failed to add reaction. Please try again.");
			} finally {
				this.loading = false;
			}
		},
		handleShare() {
			this.showShareOptions = !this.showShareOptions;
		},
		handleSave() {
			this.showComingSoonBanner();
			// TODO: Implement save functionality
		},
		showComingSoonBanner() {
			this.showBannerMessage("This feature is coming in a few days!");
		},
		showErrorBanner(message) {
			this.showBannerMessage(message);
		},
		showBannerMessage(message) {
			// Clear any existing timeout
			if (this.bannerTimeout) {
				clearTimeout(this.bannerTimeout);
			}

			// Update banner message
			this.bannerMessage = message;
			this.showBanner = true;

			// Hide after 3 seconds
			this.bannerTimeout = setTimeout(() => {
				this.showBanner = false;
			}, 3000);
		},
		toggleEmojiPicker() {
			this.showEmojiPicker = !this.showEmojiPicker;
			if (this.showEmojiPicker) {
				// Close share options if open
				this.showShareOptions = false;
			}
		},
		onEmojiSelect(emoji) {
			// emoji.native contains the emoji character
			this.addCustomReaction(emoji.native);
			this.showEmojiPicker = false;
		},
		selectEmoji(emoji) {
			this.addCustomReaction(emoji);
			this.showEmojiPicker = false;
		},
		async addCustomReaction(emoji) {
			// Check if this emoji already exists in reactions
			let reaction = this.reactions.find((r) => r.emoji === emoji);

			if (!reaction) {
				// Add new reaction to the list
				reaction = {
					emoji,
					label: this.getEmojiLabel(emoji),
					count: 0,
				};
				this.reactions.push(reaction);
			}

			// Use the existing handleReaction method
			await this.handleReaction(reaction);
		},
		handleClickOutside(event) {
			const emojiPicker = this.$el.querySelector(
				'.relative:has([aria-label="Add custom emoji reaction"])',
			);
			if (
				emojiPicker &&
				!emojiPicker.contains(event.target) &&
				this.showEmojiPicker
			) {
				this.showEmojiPicker = false;
			}
		},
	},
};
</script>