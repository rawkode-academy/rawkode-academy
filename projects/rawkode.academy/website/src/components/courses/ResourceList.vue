<template>
  <div v-if="resources && resources.length > 0" class="space-y-6">
    <div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-6 shadow-lg">
      <h3 class="text-2xl font-bold flex items-center gap-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        Resources
      </h3>
      <p class="text-sm mt-2 text-purple-100">Supporting materials for this module</p>
    </div>
    
    <div class="space-y-4">
      <div v-for="[category, categoryResources] in Object.entries(groupedResources)" :key="category" 
           class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h4 class="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 mb-4"
            :class="getCategoryColorClass(category)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getCategoryIconPath(category)"/>
          </svg>
          {{ categoryLabels[category] }}
        </h4>
        
        <div class="space-y-3">
          <component
            v-for="(resource, index) in categoryResources"
            :key="index"
            :is="resource.type === 'embed' ? 'button' : 'a'"
            :href="resource.type !== 'embed' ? getResourceHref(resource) : undefined"
            :target="resource.type === 'url' ? '_blank' : undefined"
            :rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
            @click="resource.type === 'embed' && openEmbedModal(resource)"
            class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group cursor-pointer text-left w-full"
          >
            <div class="flex-shrink-0 p-2 rounded-lg transition-colors"
                 :class="getResourceIconClass(resource.type)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2" 
                  :d="getResourceIconPath(resource.type)"
                />
              </svg>
            </div>
            
            <div class="flex-1 min-w-0">
              <h5 class="font-semibold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors">
                {{ resource.title }}
              </h5>
              <p v-if="resource.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ resource.description }}
              </p>
              <div class="flex items-center gap-3 mt-3">
                <span class="text-xs font-medium px-2 py-1 rounded-full"
                      :class="getResourceTypeBadgeClass(resource.type)">
                  {{ getResourceTypeLabel(resource.type) }}
                </span>
                <svg v-if="resource.type === 'url' || resource.type === 'embed'" 
                     class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                     :class="resource.type === 'url' ? 'text-blue-500' : 'text-purple-500'"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        :d="resource.type === 'url' ? 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' : 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z'"></path>
                </svg>
              </div>
            </div>
          </component>
        </div>
      </div>
    </div>

    <!-- Embedded App Modal -->
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
	description?: string;
	type: "url" | "file" | "embed";
	url?: string;
	filePath?: string;
	embedConfig?: {
		container:
			| "stackblitz"
			| "codesandbox"
			| "codepen"
			| "iframe"
			| "webcontainer";
		src: string;
		height?: string;
		width?: string;
		startCommand?: string;
		files?: Record<string, string>;
	};
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
			return "text-blue-600 dark:text-blue-400";
		case "documentation":
			return "text-green-600 dark:text-green-400";
		case "demos":
			return "text-purple-600 dark:text-purple-400";
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
			return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
		case "file":
			return "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400";
		case "embed":
			return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
		default:
			return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
	}
};

const getResourceTypeBadgeClass = (type: string) => {
	switch (type) {
		case "url":
			return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
		case "file":
			return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
		case "embed":
			return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
		default:
			return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
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
		// Keep modal for other embed types (StackBlitz, CodeSandbox, etc.)
		selectedEmbed.value = resource;
		isEmbedModalOpen.value = true;
	}
};
</script>