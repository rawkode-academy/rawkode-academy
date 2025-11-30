<template>
  <div class="glass-card-shimmer">
    <!-- Tab Navigation -->
    <div class="border-b border-subtle relative z-10">
      <!-- Dropdown for Mobile -->
      <div class="sm:hidden px-2 pt-2 pb-3">
        <label for="tabs-mobile" class="sr-only">Select a tab</label>
        <select
          id="tabs-mobile"
          name="tabs-mobile"
          class="glass-interactive block w-full pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-primary/50 focus:border-primary/50 sm:text-sm text-primary-content"
          :value="activeTab"
          @change="setActiveTab($event.target.value)"
        >
          <option v-for="tab in tabs" :key="tab.id" :value="tab.id">
            {{ tab.label }}
          </option>
        </select>
      </div>

      <!-- Tab bar for sm and up -->
      <nav class="hidden sm:flex -mb-px overflow-x-auto" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :id="`video-tab-${tab.id}`"
          :class="[
            'tab-button flex-shrink-0 px-4 sm:px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
            activeTab === tab.id
              ? 'border-primary text-primary dark:text-primary'
              : 'border-transparent text-muted hover:text-primary-content',
            { 'sm:ml-auto': tab.id === 'transcript' },
          ]"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`video-panel-${tab.id}`"
          @click="setActiveTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <div class="p-4 sm:p-6 relative z-10">
      <!-- Description Panel -->
      <div
        v-show="activeTab === 'description'"
        id="video-panel-description"
        role="tabpanel"
        aria-labelledby="video-tab-description"
      >
        <div
          v-if="descriptionHtml"
          class="prose prose-lg dark:prose-invert max-w-none"
          v-html="descriptionHtml"
        ></div>
        <div v-else class="text-muted">Loading description...</div>
      </div>

      <!-- Transcript Panel -->
      <div
        v-show="activeTab === 'transcript'"
        id="video-panel-transcript"
        role="tabpanel"
        aria-labelledby="video-tab-transcript"
      >
        <VideoTranscript
          :video-id="videoId"
          :is-active="activeTab === 'transcript'"
        />
      </div>

      <!-- Resources Panel -->
      <div
        v-show="activeTab === 'resources'"
        id="video-panel-resources"
        role="tabpanel"
        aria-labelledby="video-tab-resources"
      >
        <div class="prose prose-lg dark:prose-invert max-w-none">
          <p class="text-muted">
            Resources related to this video will be displayed here, including
            links, downloads, and additional materials.
          </p>
        </div>
      </div>

      <!-- Comments Panel -->
      <div
        v-show="activeTab === 'comments'"
        id="video-panel-comments"
        role="tabpanel"
        aria-labelledby="video-tab-comments"
      >
        <VideoComments :video-id="videoId" />
      </div>
    </div>
  </div>
</template>

<script>
import VideoComments from "./comments.vue";
import VideoTranscript from "./transcript.vue";

export default {
	name: "VideoContentTabs",
	components: {
		VideoTranscript,
		VideoComments,
	},
	props: {
		descriptionHtml: {
			type: String,
			required: true,
			default: "",
		},
		videoId: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			activeTab: "description",
			tabs: [
				{ id: "description", label: "Description" },
				{ id: "comments", label: "Comments" },
				{ id: "resources", label: "Resources" },
				{ id: "transcript", label: "Transcript" },
			],
		};
	},
	methods: {
		setActiveTab(tabId) {
			this.activeTab = tabId;
		},
	},
};
</script>

<style scoped>
/* Hide scrollbar on tab navigation */
nav::-webkit-scrollbar {
  display: none;
}

nav {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Additional spacing for prose paragraphs */
.prose :deep(p) {
  margin-bottom: 1.5rem;
}

/* Clean, professional link styles */
.prose :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  transition: all 0.2s ease;
}

.prose :deep(a:hover) {
  color: rgb(37 99 235);
  text-decoration-thickness: 2px;
}

.dark .prose :deep(a) {
  color: rgb(96 165 250);
}

.dark .prose :deep(a:hover) {
  color: rgb(147 197 253);
}
</style>
