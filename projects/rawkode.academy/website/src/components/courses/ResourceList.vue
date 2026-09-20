<template>
	<section v-if="groupedResources.size > 0" :class="s.root" :aria-labelledby="headingId">
		<h2 :id="headingId" :class="s.heading">Resources</h2>
		<section
			v-for="[category, categoryResources] in groupedResources"
			:key="category"
			:class="s.group"
			:aria-labelledby="`${headingId}-${category}`"
		>
			<h3 :id="`${headingId}-${category}`" :class="s.category">{{ categoryLabels[category] }}</h3>
			<ul :class="s.list" role="list">
				<li v-for="(resource, index) in categoryResources" :key="index" :class="s.item">
					<component
						:is="resource.type === 'embed' ? 'button' : 'a'"
						:type="resource.type === 'embed' ? 'button' : undefined"
						:href="getResourceHref(resource)"
						:target="resource.type === 'url' ? '_blank' : undefined"
						:rel="resource.type === 'url' ? 'noopener noreferrer' : undefined"
						:aria-haspopup="resource.type === 'embed' && resource.embedConfig?.container === 'iframe' ? 'dialog' : undefined"
						:aria-describedby="`${headingId}-${category}-${index}-details`"
						:class="s.action"
						@click="resource.type === 'embed' && openEmbedModal(resource)"
					>{{ resource.title }}</component>
					<div :id="`${headingId}-${category}-${index}-details`" :class="s.details">
						<p v-if="resource.description" :class="s.description">{{ resource.description }}</p>
						<p :class="s.kind">{{ getResourceTypeLabel(resource) }}</p>
					</div>
				</li>
			</ul>
		</section>

		<EmbeddedAppModal
			v-if="selectedEmbed"
			:resource="selectedEmbed"
			v-model="isEmbedModalOpen"
		/>
	</section>
</template>

<script setup lang="ts">
import { academyCourseResources } from "@rawkodeacademy/design-system";
import { ref, computed, useId } from "vue";
import EmbeddedAppModal from "./EmbeddedAppModal.vue";

const s = academyCourseResources();
const headingId = `${useId()}-resources`;

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
	category?: string | undefined;
}

const props = defineProps<{
	resources: Resource[];
	courseId?: string;
}>();

const isEmbedModalOpen = ref(false);
const selectedEmbed = ref<(Resource & { type: "embed"; embedConfig: NonNullable<Resource["embedConfig"]> }) | null>(null);

const categoryLabels: Record<string, string> = {
	slides: "Slides",
	code: "Code",
	documentation: "Documentation",
	demos: "Demos",
	other: "Other",
};


const isWebUrl = (value: string) => {
	if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
	try {
		const url = new URL(value, "https://academy.invalid");
		return /^https?:\/\//i.test(value)
			? url.protocol === "https:" || url.protocol === "http:"
			: value.startsWith("/") && !value.startsWith("//") && url.origin === "https://academy.invalid";
	} catch {
		return false;
	}
};

const getResourceHref = (resource: Resource): string | undefined => {
	if (resource.type === "url") {
		const url = resource.url?.trim();
		return url && isWebUrl(url) ? url : undefined;
	}
	if (resource.type === "file") {
		const filePath = resource.filePath?.trim();
		if (!filePath || filePath.startsWith("/") || /[\\?#\u0000-\u001f\u007f]/.test(filePath)) return undefined;
		const href = `/resources/${filePath}`;
		const pathname = new URL(href, "https://academy.invalid").pathname;
		return pathname.startsWith("/resources/") && pathname !== "/resources/" ? href : undefined;
	}
	return undefined;
};

const groupedResources = computed(() => {
	const groups = new Map<string, Resource[]>();
	for (const resource of props.resources) {
		if (!resource.title.trim()) continue;
		if (resource.type === "embed") {
			const config = resource.embedConfig;
			if (!config?.src.trim()) continue;
			if (config.container === "iframe" ? !isWebUrl(config.src.trim()) : config.container !== "webcontainer") continue;
		} else if (!getResourceHref(resource)) {
			continue;
		}
		const category = resource.category?.trim().toLowerCase() ?? "other";
		const key = Object.hasOwn(categoryLabels, category) ? category : "other";
		const group = groups.get(key) ?? [];
		group.push(resource);
		groups.set(key, group);
	}
	return groups;
});

const getResourceTypeLabel = (resource: Resource) => {
	switch (resource.type) {
		case "url": return "Link · opens in a new tab";
		case "file": return "File";
		case "embed": return resource.embedConfig?.container === "webcontainer"
			? "WebContainer · opens in a new window"
			: "Interactive demo · opens a dialog";
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
