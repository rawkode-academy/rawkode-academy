<template>
 <div class="paper-card bleed-x-mobile">
 <!-- Tab Navigation -->
 <div class="border-b border-subtle relative z-10">
 <!-- Dropdown for Mobile -->
 <div class="sm:hidden px-2 pt-2 pb-3">
 <label for="tabs-mobile" class="sr-only">Select a tab</label>
 <select
 id="tabs-mobile"
 name="tabs-mobile"
 class="paper-card-muted block w-full pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-primary/50 focus:border-primary/50 sm:text-sm text-primary-content"
 :value="activeTab"
 @change="setActiveTab($event.target.value)"
 >
 <option
 v-for="tab in tabs"
 :key="tab.id"
 :value="tab.id"
 :selected="activeTab === tab.id"
 >
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
 <div class="space-y-6">
 <section v-if="whatYouWillLearn.length > 0" aria-labelledby="video-learn-heading">
 <h3 id="video-learn-heading" class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
 What You'll Learn
 </h3>
 <ol class="video-learn-list">
 <li v-for="item in whatYouWillLearn" :key="item">
 {{ item }}
 </li>
 </ol>
 </section>
 <section v-if="descriptionHtml" class="prose prose-lg dark:prose-invert max-w-none" v-html="descriptionHtml" />
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
 <div v-if="!resources || resources.length === 0" class="prose prose-lg dark:prose-invert max-w-none">
 <p class="text-muted">No resources for this episode yet.</p>
 </div>
 <div v-else class="space-y-6">
 <div v-for="group in groupedResources" :key="group.category">
 <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
 {{ categoryLabel(group.category) }}
 </h3>
 <div class="grid gap-3">
 <a
 v-for="(resource, idx) in group.items"
 :key="resource.id || `${group.category}-${idx}`"
 :href="resource.url || resource.filePath || '#'"
 :target="resource.type === 'url' ? '_blank' : undefined"
 :rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
 class="flex items-start gap-3 p-3 rounded-sm bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth group"
 >
 <svg
 class="w-5 h-5 mt-0.5 text-muted group-hover:text-primary flex-shrink-0"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 stroke-linecap="round"
 stroke-linejoin="round"
 stroke-width="2"
 :d="categoryIcon(group.category)"
 />
 </svg>
 <div class="flex-1 min-w-0">
 <div class="font-medium text-primary-content group-hover:text-primary">
 {{ resource.title }}
 </div>
 <div v-if="resource.description" class="text-sm text-muted mt-0.5">
 {{ resource.description }}
 </div>
 </div>
 <svg
 v-if="resource.type === 'url'"
 class="w-4 h-4 mt-1 text-muted group-hover:text-primary flex-shrink-0"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 stroke-linecap="round"
 stroke-linejoin="round"
 stroke-width="2"
 d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
 />
 </svg>
 </a>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
</template>

<script>
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

const CATEGORY_ORDER = ["documentation", "code", "slides", "demos", "other"];

const CATEGORY_ICONS = {
	documentation:
		"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
	code: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
	slides: "M7 4v16M17 4v16M3 12h18M8 12h8",
	demos:
		"M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
	other:
		"M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
};

const CATEGORY_LABELS = {
	documentation: "Documentation",
	code: "Code",
	slides: "Slides",
	demos: "Demos",
	other: "Additional Resources",
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
		resources: {
			type: Array,
			default: () => [],
		},
		descriptionHtml: {
			type: String,
			default: "",
		},
		whatYouWillLearn: {
			type: Array,
			default: () => [],
		},
	},
	data() {
		return {
			activeTab: "description",
			tabs: [
				{ id: "description", label: "Description" },
				{ id: "comments", label: "Comments" },
				{ id: "transcript", label: "Transcript" },
				{ id: "resources", label: "Resources" },
			],
		};
	},
	computed: {
		groupedResources() {
			const groups = new Map();
			for (const resource of this.resources || []) {
				const category = resource.category || "other";
				if (!groups.has(category)) groups.set(category, []);
				groups.get(category).push(resource);
			}
			return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
				category,
				items: groups.get(category),
			}));
		},
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
		categoryIcon(category) {
			return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
		},
		categoryLabel(category) {
			return CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
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

.video-learn-list {
 counter-reset: video-learn-item;
 display: grid;
 gap: 0.875rem;
 margin: 0;
 padding: 0;
 list-style: none;
}

.video-learn-list li {
 counter-increment: video-learn-item;
 display: grid;
 grid-template-columns: 2rem minmax(0, 1fr);
 gap: 0.875rem;
 align-items: start;
 color: var(--editorial-ink, rgb(17 24 39));
 line-height: 1.6;
}

.video-learn-list li::before {
 content: counter(video-learn-item);
 display: inline-grid;
 place-items: center;
 width: 2rem;
 height: 2rem;
 border-radius: 999px;
 border: 1px solid color-mix(in srgb, var(--editorial-spruce, rgb(13 148 136)) 35%, transparent);
 background: color-mix(in srgb, var(--editorial-spruce, rgb(13 148 136)) 10%, transparent);
 color: var(--editorial-spruce, rgb(13 148 136));
 font-size: 0.75rem;
 font-weight: 700;
 line-height: 1;
 margin-top: 0.125rem;
 font-variant-numeric: tabular-nums;
}

.dark .video-learn-list li {
 color: rgb(229 231 235);
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
