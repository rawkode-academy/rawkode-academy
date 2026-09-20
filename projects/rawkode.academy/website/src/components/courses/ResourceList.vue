<template>
	<div v-if="resources && resources.length > 0" :class="s.resources">
		<header :class="s.header">
			<div :class="s.heading">
				<svg :class="s.icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
				</svg>
				<h3 :class="s.heading">Resources</h3>
			</div>
			<p :class="s.description">
				Supporting materials for this module.
			</p>
		</header>

		<div :class="s.resources">
			<section
				v-for="[category, categoryResources] in Object.entries(groupedResources)"
				:key="category"
				:class="s.group"
			>
				<h4
					:class="s.category"
				>
					<svg :class="s.smallIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getCategoryIconPath(category)" />
					</svg>
					{{ categoryLabels[category] }}
				</h4>

				<div :class="s.resources">
					<component
						v-for="(resource, index) in categoryResources"
						:key="index"
						:is="resource.type === 'embed' ? 'button' : 'a'"
						:type="resource.type === 'embed' ? 'button' : undefined"
						:href="resource.type !== 'embed' ? getResourceHref(resource) : undefined"
						:target="resource.type === 'url' ? '_blank' : undefined"
						:rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
						@click="resource.type === 'embed' && openEmbedModal(resource)"
						:class="s.resource"
					>
						<div
							:class="s.iconBadge"
						>
							<svg :class="s.icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									:d="getResourceIconPath(resource.type)"
								/>
							</svg>
						</div>

						<div :class="s.copy">
							<h5 :class="s.title">
								{{ resource.title }}
							</h5>
							<p v-if="resource.description" :class="s.description">
								{{ resource.description }}
							</p>
							<div :class="s.meta">
								<span>
									{{ getResourceTypeLabel(resource.type) }}
								</span>
							</div>
						</div>

						<div :class="s.arrow">
							<svg
								:class="s.smallIcon"

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
import { academyCourse } from "@rawkodeacademy/design-system";
const s = academyCourse();
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
const selectedEmbed = ref<(Resource & { type: "embed"; embedConfig: NonNullable<Resource["embedConfig"]> }) | null>(null);

const categoryLabels: Record<string, string> = {
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
			acc[resource.category]!.push(resource);
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

		const url = `/embed/webcontainer?course=${encodeURIComponent(courseId ?? "unknown")}&resource=${encodeURIComponent(resourceId)}`;
		window.open(
			url,
			"webcontainer",
			"width=1200,height=800,toolbar=no,menubar=no,location=no,status=no,noopener,noreferrer",
		);
	} else {
		// Keep modal for other embed types
		if (!resource.embedConfig) return;
		selectedEmbed.value = { ...resource, type: "embed", embedConfig: resource.embedConfig };
		isEmbedModalOpen.value = true;
	}
};
</script>
