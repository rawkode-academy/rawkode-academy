<template>
  <div class="glass-card-shimmer">
    <!-- Tab Navigation -->
    <div :class="tabNavClass" class="border-subtle">
      <!-- Dropdown for Mobile -->
      <div :class="mobileSelectWrapClass">
        <label for="tabs-mobile" class="sr-only">Select a tab</label>
        <select
          id="tabs-mobile"
          name="tabs-mobile"
          :class="mobileSelectClass"
          class="glass-interactive"
          :value="activeTab"
          @change="setActiveTab($event.target.value)"
        >
          <option v-for="tab in tabs" :key="tab.id" :value="tab.id">
            {{ tab.label }}
          </option>
        </select>
      </div>

      <!-- Tab bar for sm and up -->
      <nav :class="tabBarClass" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :id="`video-tab-${tab.id}`"
          :class="[
            tabButtonClass,
            activeTab === tab.id ? activeTabClass : inactiveTabClass,
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
    <div :class="tabContentClass">
      <!-- Comments Panel -->
      <div
        v-show="activeTab === 'comments'"
        id="video-panel-comments"
        role="tabpanel"
        aria-labelledby="video-tab-comments"
      >
        <VideoComments :video-id="videoId" />
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
        <div class="prose prose-lg dark:prose-invert" :class="proseWrapClass">
          <p class="text-muted">
            Resources related to this video will be displayed here, including
            links, downloads, and additional materials.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { css } from "../../../styled-system/css";
import VideoComments from "./comments.vue";
import VideoTranscript from "./transcript.vue";

// Track analytics events client-side
const trackEvent = (event, properties) => {
	try {
		window.posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

const tabStyles = {
	tabNavClass: css({
		borderBottomWidth: "1px",
		position: "relative",
		zIndex: 10,
	}),
	mobileSelectWrapClass: css({
		display: { base: "block", sm: "none" },
		px: "2",
		pt: "2",
		pb: "3",
	}),
	mobileSelectClass: css({
		display: "block",
		w: "full",
		pl: "3",
		pr: "10",
		py: "2",
		fontSize: { base: "base", sm: "sm" },
		_focus: { outline: "none", ringColor: "rgba(var(--brand-primary), 0.5)", borderColor: "rgba(var(--brand-primary), 0.5)" },
	}),
	tabBarClass: css({
		display: { base: "none", sm: "flex" },
		mb: "-1px",
		overflowX: "auto",
	}),
	tabButtonClass: css({
		flexShrink: 0,
		px: { base: "4", sm: "6" },
		py: "3",
		borderBottomWidth: "2px",
		fontWeight: "medium",
		fontSize: "sm",
		whiteSpace: "nowrap",
		transition: "colors",
	}),
	activeTabClass: css({
		borderColor: "rgb(var(--brand-primary))",
		color: "rgb(var(--brand-primary))",
	}),
	inactiveTabClass: css({
		borderColor: "transparent",
		color: { base: "gray.500", _dark: "gray.400" },
		_hover: { color: { base: "gray.900", _dark: "white" } },
	}),
	tabContentClass: css({
		p: { base: "4", sm: "6" },
		position: "relative",
		zIndex: 10,
	}),
	proseWrapClass: css({ maxWidth: "none" }),
};

export default {
	name: "VideoContentTabs",
	components: {
		VideoTranscript,
		VideoComments,
	},
	props: {
		videoId: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			activeTab: "comments",
			tabs: [
				{ id: "comments", label: "Comments" },
				{ id: "transcript", label: "Transcript" },
				{ id: "resources", label: "Resources" },
			],
		};
	},
	created() {
		Object.assign(this, tabStyles);
	},
	methods: {
		setActiveTab(tabId) {
			const previousTab = this.activeTab;
			this.activeTab = tabId;
			// Track tab view
			trackEvent("video_tab_viewed", {
				tab_id: tabId,
				previous_tab: previousTab,
				video_id: this.videoId,
			});
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
