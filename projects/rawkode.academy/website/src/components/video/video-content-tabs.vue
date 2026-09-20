<script setup lang="ts">
import { Tabs } from "@ark-ui/vue/tabs";
import { computed, ref, useId, watch as watchValue } from "vue";
import { academyWatch, tabs as academyTabs } from "@rawkodeacademy/design-system";
import VideoComments from "./comments.vue";

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
const watch = academyWatch();
const tabStyles = academyTabs({ tone: "academy" });

const mobileSelectId = useId();
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

function resourceHref(resource: Resource): string | undefined {
	for (const candidate of [resource.url, resource.filePath]) {
		const href = candidate?.trim();
		if (!href || href.startsWith("#") || href.startsWith("//") || /[\\\u0000-\u0020]/.test(href)) continue;
		try {
			const url = new URL(href, "https://rawkode.academy/");
			if (url.protocol === "https:" || url.protocol === "http:") return href;
		} catch {
			// An invalid destination is not a resource link.
		}
	}
	return undefined;
}

const validResources = computed(() => props.resources.flatMap((resource) => {
	const href = resourceHref(resource);
	if (!href || !resource.title.trim()) return [];
	return [{ ...resource, href, category: categoryOrder.includes(resource.category ?? "") ? resource.category! : "other" }];
}));
const activeTab = ref(validResources.value.length > 0 ? "resources" : "comments");
const tabs = computed(() => validResources.value.length > 0
	? [{ id: "comments", label: "Comments" }, { id: "resources", label: "Resources" }]
	: [{ id: "comments", label: "Comments" }]);
watchValue(validResources, (resources) => {
	if (resources.length === 0 && activeTab.value === "resources") activeTab.value = "comments";
});

const groupedResources = computed(() => {
	const groups = new Map<string, typeof validResources.value>();
	for (const resource of validResources.value) {
		const category = resource.category;
		groups.set(category, [...(groups.get(category) ?? []), resource]);
	}
	return categoryOrder
		.filter((category) => groups.has(category))
		.map((category) => ({ category, items: groups.get(category) ?? [] }));
});

const setActiveTab = (tabId: string) => {
	if (!tabs.value.some((tab) => tab.id === tabId) || activeTab.value === tabId) return;
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
	<section v-if="validResources.length === 0" :class="watch.section">
		<VideoComments :video-id="videoId" :heading-level="2" />
	</section>
	<Tabs.Root v-else :value="activeTab" :default-value="activeTab" :class="watch.tabsRoot" @value-change="setActiveTab($event.value)">
		<h2 class="sr-only">{{ validResources.length > 0 ? "Comments and resources" : "Comments" }}</h2>
		<div>
			<div :class="watch.tabMobile">
				<label :for="mobileSelectId" class="sr-only">Select a video content section</label>
				<select :id="mobileSelectId" :name="mobileSelectId" :class="watch.tabSelect" :value="activeTab" @change="handleMobileChange">
					<option v-for="tab in tabs" :key="tab.id" :value="tab.id">{{ tab.label }}</option>
				</select>
			</div>

			<Tabs.List :class="[tabStyles.list, watch.tabDesktop]" aria-label="Video content sections">
				<Tabs.Trigger v-for="tab in tabs" :key="tab.id" :value="tab.id" :class="tabStyles.trigger">
					{{ tab.label }}
				</Tabs.Trigger>
				<Tabs.Indicator :class="tabStyles.indicator" />
			</Tabs.List>
		</div>

		<Tabs.Content value="comments" :class="tabStyles.content"><VideoComments :video-id="videoId" /></Tabs.Content>
		<Tabs.Content v-if="validResources.length > 0" value="resources" :class="tabStyles.content">
				<div :class="watch.resourceGroups">
					<div v-for="group in groupedResources" :key="group.category" :class="watch.resourceGroup">
						<h3 :class="watch.resourceHeading">{{ categoryLabels[group.category] || categoryLabels.other }}</h3>
						<div :class="watch.resourceList">
							<a v-for="(resource, idx) in group.items" :key="resource.id || `${group.category}-${idx}`" :href="resource.href" :target="resource.type === 'url' ? '_blank' : undefined" :rel="resource.type === 'url' ? 'noopener noreferrer' : undefined" :class="watch.resourceLink">
								<svg :class="watch.resourceIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="categoryIcons[group.category] || categoryIcons.other" /></svg>
								<div :class="watch.resourceBody"><div :class="watch.resourceTitle">{{ resource.title }}</div><div v-if="resource.description" :class="watch.resourceDescription">{{ resource.description }}</div></div>
								<svg v-if="resource.type === 'url'" :class="watch.resourceExternal" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
							</a>
						</div>
					</div>
				</div>
			</Tabs.Content>
	</Tabs.Root>
</template>
