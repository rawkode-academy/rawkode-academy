<template>
  <div v-if="resources && resources.length > 0" :class="css({ display: 'flex', flexDirection: 'column', gap: '6' })">
    <div :class="css({ bgGradient: 'to-r', gradientFrom: 'teal.500', gradientTo: 'green.400', color: 'white', borderRadius: 'xl', p: '6', shadow: 'lg' })">
      <h3 :class="css({ fontSize: '2xl', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3' })">
        <svg :class="css({ w: '6', h: '6' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        Resources
      </h3>
      <p :class="css({ fontSize: 'sm', mt: '2', opacity: '0.8' })">Supporting materials for this module</p>
    </div>

    <div :class="css({ display: 'flex', flexDirection: 'column', gap: '4' })">
      <div v-for="[category, categoryResources] in Object.entries(groupedResources)" :key="category"
           :class="css({ bg: { base: 'white', _dark: 'gray.800' }, borderRadius: 'xl', p: '5', shadow: 'sm', borderWidth: '1px', borderColor: { base: 'gray.100', _dark: 'gray.700' } })">
        <h4 :class="[css({ fontSize: 'sm', fontWeight: 'semibold', textTransform: 'uppercase', letterSpacing: 'wider', display: 'flex', alignItems: 'center', gap: '2', mb: '4' }), getCategoryColorClass(category)]">
          <svg :class="css({ w: '4', h: '4' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getCategoryIconPath(category)"/>
          </svg>
          {{ categoryLabels[category] }}
        </h4>

        <div :class="css({ display: 'flex', flexDirection: 'column', gap: '3' })">
          <component
            v-for="(resource, index) in categoryResources"
            :key="index"
            :is="resource.type === 'embed' ? 'button' : 'a'"
            :href="resource.type !== 'embed' ? getResourceHref(resource) : undefined"
            :target="resource.type === 'url' ? '_blank' : undefined"
            :rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
            @click="resource.type === 'embed' && openEmbedModal(resource)"
            :class="css({ display: 'flex', alignItems: 'flex-start', gap: '3', p: '4', bg: { base: 'gray.50', _dark: 'gray.900' }, borderRadius: 'lg', cursor: 'pointer', textAlign: 'left', w: 'full', transition: 'all', _hover: { bg: { base: 'gray.100', _dark: 'gray.800' } } })"
          >
            <div :class="[css({ flexShrink: '0', p: '2', borderRadius: 'lg', transition: 'colors' }), getResourceIconClass(resource.type)]">
              <svg :class="css({ w: '5', h: '5' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  :d="getResourceIconPath(resource.type)"
                />
              </svg>
            </div>

            <div :class="css({ flex: '1', minW: '0' })">
              <h5 :class="css({ fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' }, transition: 'colors' })">
                {{ resource.title }}
              </h5>
              <p v-if="resource.description" :class="css({ fontSize: 'sm', color: { base: 'gray.600', _dark: 'gray.400' }, mt: '1' })">
                {{ resource.description }}
              </p>
              <div :class="css({ display: 'flex', alignItems: 'center', gap: '3', mt: '3' })">
                <span :class="[css({ fontSize: 'xs', fontWeight: 'medium', px: '2', py: '1', borderRadius: 'full' }), getResourceTypeBadgeClass(resource.type)]">
                  {{ getResourceTypeLabel(resource.type) }}
                </span>
                <svg v-if="resource.type === 'url' || resource.type === 'embed'"
                     :class="css({ w: '4', h: '4', opacity: '0', transition: 'opacity', color: resource.type === 'url' ? 'teal.500' : 'green.400' })"
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
import { css } from "../../styled-system/css";
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
			return css({ color: { base: 'orange.600', _dark: 'orange.400' } });
		case "code":
			return css({ color: 'teal.500' });
		case "documentation":
			return css({ color: { base: 'green.600', _dark: 'green.400' } });
		case "demos":
			return css({ color: 'green.400' });
		default:
			return css({ color: { base: 'gray.600', _dark: 'gray.400' } });
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
			return css({ bg: 'teal.500/10', color: 'teal.500' });
		case "file":
			return css({ bg: { base: 'green.100', _dark: 'green.900/30' }, color: { base: 'green.600', _dark: 'green.400' } });
		case "embed":
			return css({ bg: 'green.400/10', color: 'green.400' });
		default:
			return css({ bg: { base: 'gray.100', _dark: 'gray.800' }, color: { base: 'gray.600', _dark: 'gray.400' } });
	}
};

const getResourceTypeBadgeClass = (type: string) => {
	switch (type) {
		case "url":
			return css({ bg: 'teal.500/10', color: 'teal.500' });
		case "file":
			return css({ bg: { base: 'green.100', _dark: 'green.900/30' }, color: { base: 'green.700', _dark: 'green.300' } });
		case "embed":
			return css({ bg: 'green.400/10', color: 'green.400' });
		default:
			return css({ bg: { base: 'gray.100', _dark: 'gray.800' }, color: { base: 'gray.700', _dark: 'gray.300' } });
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
