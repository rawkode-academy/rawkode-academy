<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <!-- Reaction Buttons -->
      <div class="flex items-center gap-1 sm:gap-2">
        <button
          v-for="reaction in reactions"
          :key="reaction.emoji"
          :aria-label="`${reaction.label} (${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'})`"
          class="group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="handleReaction(reaction)"
        >
          <span
            aria-hidden="true"
            class="text-xl sm:text-2xl group-hover:scale-110 transition-transform"
          >
            {{ reaction.emoji }}
          </span>
          <span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ reaction.count }}
          </span>
        </button>
      </div>

      <!-- Share Options -->
      <div class="flex items-center gap-2">
        <button
          aria-label="Share this video"
          class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="handleShare"
        >
          <svg
            aria-hidden="true"
            class="w-4 sm:w-5 h-4 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684C18.114 16.938 18 16.482 18 16c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span class="text-xs sm:text-sm font-medium">Share</span>
        </button>
        <button
          aria-label="Save this video for later"
          class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="handleSave"
        >
          <svg
            aria-hidden="true"
            class="w-4 sm:w-5 h-4 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <span class="text-xs sm:text-sm font-medium">Save</span>
        </button>
      </div>
    </div>

    <!-- Coming Soon Banner -->
    <transition
      name="banner"
      enter-active-class="transition-all duration-300 ease-in-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-300 ease-in-out"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="showBanner"
        class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
      >
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span class="text-sm font-medium">This feature is coming in a few days!</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    videoId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      showBanner: false,
      bannerTimeout: null,
      reactions: [
        { emoji: '👍', label: 'Like this video', count: 124 },
        { emoji: '🚀', label: 'Rocket reaction', count: 89 },
        { emoji: '💡', label: 'Insightful reaction', count: 45 },
      ],
    };
  },
  methods: {
    handleReaction(reaction) {
      this.showComingSoonBanner();
      // TODO: Implement reaction logic when backend is ready
    },
    handleShare() {
      this.showComingSoonBanner();
      // TODO: Implement share functionality
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