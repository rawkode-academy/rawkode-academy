<script setup lang="ts">
import { Tabs } from "@ark-ui/vue/tabs";
import { computed, ref } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import VideoComments from "./comments.vue";
import VideoTranscript from "./transcript.vue";

interface Resource {
	id?: string | undefined;
	title: string;
	description?: string | undefined;
	type: "url" | "file" | "embed";
	url?: string | undefined;
	filePath?: string | undefined;
	category?: string | undefined;
}

const props = withDefaults(defineProps<{ videoId: string; resources?: Resource[] }>(), {
	resources: () => [],
});

const activeTab = ref("resources");
const tabs = [
	{ id: "comments", label: "Comments" },
	{ id: "transcript", label: "Transcript" },
	{ id: "resources", label: "Resources" },
];
const categoryOrder = ["documentation", "code", "slides", "demos", "other"];
const categoryLabels: Record<string, string> = {
	documentation: "Documentation",
	code: "Code",
	slides: "Slides",
	demos: "Demos",
	other: "Additional Resources",
};
const categoryIcons: Record<string, string> = {
	documentation: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
	code: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
	slides: "M7 4v16M17 4v16M3 12h18M8 12h8",
	demos: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
	other: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
};

const groupedResources = computed(() => {
	const groups = new Map<string, Resource[]>();
	for (const resource of props.resources) {
		const category = resource.category || "other";
		groups.set(category, [...(groups.get(category) ?? []), resource]);
	}
	return categoryOrder
		.filter((category) => groups.has(category))
		.map((category) => ({ category, items: groups.get(category) ?? [] }));
});

const setActiveTab = (tabId: string) => {
	if (!tabs.some((tab) => tab.id === tabId) || activeTab.value === tabId) return;
	const previousTab = activeTab.value;
	activeTab.value = tabId;
	try {
		window.posthog?.capture("video_tab_viewed", {
			tab_id: tabId,
			previous_tab: previousTab,
			video_id: props.videoId,
		});
	} catch {
		// Analytics must never block tab navigation.
	}
};

const handleMobileChange = (event: Event) => {
	setActiveTab((event.target as HTMLSelectElement).value);
};
</script>

<template>
	<Tabs.Root :value="activeTab" class="paper-card bleed-x-mobile" @value-change="setActiveTab($event.value)">
		<h2 class="sr-only">Comments, transcript, and resources</h2>
		<div class="border-b border-subtle relative z-10">
			<div class="sm:hidden px-2 pt-2 pb-3">
				<label for="tabs-mobile" class="sr-only">Select a tab</label>
				<select id="tabs-mobile" name="tabs-mobile" class="paper-card-muted block w-full pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-primary/50 focus:border-primary/50 sm:text-sm text-primary-content" :value="activeTab" @change="handleMobileChange">
					<option v-for="tab in tabs" :key="tab.id" :value="tab.id">{{ tab.label }}</option>
				</select>
			</div>

			<Tabs.List class="video-tab-list hidden sm:flex -mb-px overflow-x-auto" aria-label="Video content sections">
				<Tabs.Trigger v-for="tab in tabs" :key="tab.id" :value="tab.id" class="tab-button flex-shrink-0 px-4 sm:px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors border-transparent text-muted hover:text-primary-content data-[selected]:border-primary data-[selected]:text-primary">
					{{ tab.label }}
				</Tabs.Trigger>
				<Tabs.Indicator />
			</Tabs.List>
		</div>

		<div class="p-4 sm:p-6 relative z-10">
			<Tabs.Content value="comments"><VideoComments :video-id="videoId" /></Tabs.Content>
			<Tabs.Content value="transcript"><VideoTranscript :video-id="videoId" :is-active="activeTab === 'transcript'" /></Tabs.Content>
			<Tabs.Content value="resources">
				<EmptyState v-if="resources.length === 0" title="No resources for this episode yet." />
				<div v-else class="space-y-6">
					<div v-for="group in groupedResources" :key="group.category">
						<h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">{{ categoryLabels[group.category] || categoryLabels.other }}</h3>
						<div class="grid gap-3">
							<a v-for="(resource, idx) in group.items" :key="resource.id || `${group.category}-${idx}`" :href="resource.url || resource.filePath || '#'" :target="resource.type === 'url' ? '_blank' : undefined" :rel="resource.type === 'url' ? 'noopener noreferrer' : undefined" class="flex items-start gap-3 p-3 rounded-sm bg-[var(--surface-card-muted)] hover:bg-[var(--surface-card)] transition-smooth group">
								<svg class="w-5 h-5 mt-0.5 text-muted group-hover:text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="categoryIcons[group.category] || categoryIcons.other" /></svg>
								<div class="flex-1 min-w-0"><div class="font-medium text-primary-content group-hover:text-primary">{{ resource.title }}</div><div v-if="resource.description" class="text-sm text-muted mt-0.5">{{ resource.description }}</div></div>
								<svg v-if="resource.type === 'url'" class="w-4 h-4 mt-1 text-muted group-hover:text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
							</a>
						</div>
					</div>
				</div>
			</Tabs.Content>
		</div>
	</Tabs.Root>
</template>

<style scoped>
.video-tab-list::-webkit-scrollbar { display: none; }
.video-tab-list { -ms-overflow-style: none; scrollbar-width: none; }
</style>
