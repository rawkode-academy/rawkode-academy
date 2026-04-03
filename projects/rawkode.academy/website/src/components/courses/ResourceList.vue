<template>
	<div v-if="resources && resources.length > 0" class="space-y-6">
		<header class="border-b border-black/10 pb-5 dark:border-white/10">
			<div class="flex items-center gap-3">
				<svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
				</svg>
				<h3 class="text-2xl font-bold tracking-tight text-primary-content">Resources</h3>
			</div>
			<p class="mt-2 text-sm leading-7 text-secondary-content">
				Supporting materials for this module.
			</p>
		</header>

		<div class="space-y-6">
			<section
				v-for="[category, categoryResources] in Object.entries(groupedResources)"
				:key="category"
				class="border-b border-black/8 pb-6 last:border-b-0 last:pb-0 dark:border-white/8"
			>
				<h4
					class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]"
					:class="getCategoryColorClass(category)"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getCategoryIconPath(category)" />
					</svg>
					{{ categoryLabels[category] }}
				</h4>

				<div class="divide-y divide-black/8 dark:divide-white/8">
					<component
						v-for="(resource, index) in categoryResources"
						:key="index"
						:is="resource.type === 'embed' ? 'button' : 'a'"
						:type="resource.type === 'embed' ? 'button' : undefined"
						:href="resource.type !== 'embed' ? getResourceHref(resource) : undefined"
						:target="resource.type === 'url' ? '_blank' : undefined"
						:rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
						@click="resource.type === 'embed' && openEmbedModal(resource)"
						class="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-4 text-left transition-colors"
					>
						<div
							class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full"
							:class="getResourceIconClass(resource.type)"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									:d="getResourceIconPath(resource.type)"
								/>
							</svg>
						</div>

						<div class="min-w-0">
							<h5 class="font-semibold text-primary-content transition-colors group-hover:text-primary">
								{{ resource.title }}
							</h5>
							<p v-if="resource.description" class="mt-1 text-sm leading-6 text-secondary-content">
								{{ resource.description }}
							</p>
							<div class="mt-3 flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted">
								<span :class="getResourceTypeBadgeClass(resource.type)">
									{{ getResourceTypeLabel(resource.type) }}
								</span>
							</div>
						</div>

						<div class="flex items-start justify-end pt-1">
							<svg
								class="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
								:class="resource.type === 'embed' ? 'text-secondary' : 'text-primary'"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									:d="resource.type === 'file' ? 'M12 5v14m0 0l-4-4m4 4l4-4' : 'M9 5l7 7-7 7'"
								></path>
							</svg>
						</div>
					</component>
				</div>
			</section>
		</div>

		<EmbeddedAppModal
			v-if="selectedEmbed"
			:resource="selectedEmbed"
			v-model="isEmbedModalOpen"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import EmbeddedAppModal from "./EmbeddedAppModal.vue";

interface Resource {
	title: string;
	description?: string | undefined;
	type: "url" | "file" | "embed";
	url?: string | undefined;
	filePath?: string | undefined;
	embedConfig?:
		| {
				container: "webcontainer" | "iframe";
				src: string;
				height: string;
				width: string;
				startCommand?: string | undefined;
				files?: Record<string, string> | undefined;
				import?:
					| {
							localDir: string;
					  }
					| undefined;
		  }
		| undefined;
	category: "slides" | "code" | "documentation" | "demos" | "other";
}

const props = defineProps<{
	resources: Resource[];
	courseId?: string;
}>();

const isEmbedModalOpen = ref(false);
const selectedEmbed = ref<Resource | null>(null);

const categoryLabels = {
	slides: "Slides",
	code: "Repos",
	documentation: "Documentation",
	demos: "Demos",
	other: "Other Resources",
};

const groupedResources = computed(() => {
	return props.resources.reduce(
		(acc, resource) => {
			if (!acc[resource.category]) {
				acc[resource.category] = [];
			}
			acc[resource.category].push(resource);
			return acc;
		},
		{} as Record<string, Resource[]>,
	);
});

const getCategoryIconPath = (category: string) => {
	switch (category) {
		case "slides":
			return "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z";
		case "code":
			return "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
		case "documentation":
			return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
		case "demos":
			return "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
		default:
			return "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
	}
};

const getCategoryColorClass = (category: string) => {
	switch (category) {
		case "slides":
			return "text-orange-600 dark:text-orange-400";
		case "code":
			return "text-primary dark:text-primary";
		case "documentation":
			return "text-green-600 dark:text-green-400";
		case "demos":
			return "text-secondary dark:text-secondary";
		default:
			return "text-gray-600 dark:text-gray-400";
	}
};

const getResourceIconPath = (type: string) => {
	switch (type) {
		case "url":
			return "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14";
		case "file":
			return "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
		case "embed":
			return "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
		default:
			return "M13 10V3L4 14h7v7l9-11h-7z";
	}
};

const getResourceIconClass = (type: string) => {
	switch (type) {
		case "url":
			return "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary";
		case "file":
			return "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400";
		case "embed":
			return "bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-secondary";
		default:
			return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
	}
};

const getResourceTypeBadgeClass = (type: string) => {
	switch (type) {
		case "url":
			return "text-primary";
		case "file":
			return "text-green-700 dark:text-green-300";
		case "embed":
			return "text-secondary";
		default:
			return "text-gray-700 dark:text-gray-300";
	}
};

const getResourceHref = (resource: Resource) => {
	if (resource.type === "url") {
		return resource.url;
	} else if (resource.type === "file" && resource.filePath) {
		return `/resources/${resource.filePath}`;
	}
	return "#";
};

const getResourceTypeLabel = (type: string) => {
	switch (type) {
		case "url":
			return "External Link";
		case "file":
			return "Download";
		case "embed":
			return "Demo";
		default:
			return type;
	}
};

const openEmbedModal = (resource: Resource) => {
	if (resource.embedConfig?.container === "webcontainer") {
		// Open WebContainer in a new window
		const resourceId = resource.embedConfig.src;
		// Get course ID from the current URL path
		const pathParts = window.location.pathname.split("/");
		const courseIndex = pathParts.indexOf("courses");
		const courseId =
			courseIndex >= 0
				? pathParts[courseIndex + 1]
				: props.courseId || "unknown";

		const url = `/embed/webcontainer?course=${courseId}&resource=${resourceId}`;
		window.open(
			url,
			"webcontainer",
			"width=1200,height=800,toolbar=no,menubar=no,location=no,status=no,noopener,noreferrer",
		);
	} else {
		// Keep modal for other embed types
		selectedEmbed.value = resource;
		isEmbedModalOpen.value = true;
	}
};
</script>
