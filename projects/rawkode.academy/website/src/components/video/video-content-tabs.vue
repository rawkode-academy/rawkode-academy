<template>
  <div
    class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800"
  >
    <!-- Tab Navigation -->
    <div class="border-b border-gray-200 dark:border-gray-800">
      <!-- Dropdown for Mobile -->
      <div class="sm:hidden px-2 pt-2 pb-3">
        <label for="tabs-mobile" class="sr-only">Select a tab</label>
        <select
          id="tabs-mobile"
          name="tabs-mobile"
          class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
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
    <div class="p-6">
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
        <div v-else class="text-gray-500">Loading description...</div>
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
          <p class="text-gray-600 dark:text-gray-400">
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
import VideoTranscript from "./transcript.vue";
import VideoComments from "./comments.vue";

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

/* Professional typography for prose content */
.prose {
  line-height: 1.75;
  color: rgb(55 65 81);
}

.dark .prose {
  color: rgb(209 213 219);
}

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
