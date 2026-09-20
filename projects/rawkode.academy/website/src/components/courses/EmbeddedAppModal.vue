<template>
 <Dialog.Root :lazy-mount="true" :unmount-on-exit="true" :open="isOpen" @open-change="isOpen = $event.open">
 <Teleport to="body">
 <Dialog.Backdrop :class="modal.backdrop" />
 <Dialog.Positioner :class="modal.positioner">
 <Dialog.Content
 :class="modal.content"
 >
 <!-- Header -->
 <div :class="s.toolbar">
 <Dialog.Title :class="modal.title">
 {{ resource.title }}
 </Dialog.Title>
 <Dialog.CloseTrigger
 :class="s.button"
 aria-label="Close"
 >
 <svg :class="s.icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </Dialog.CloseTrigger>
 </div>

 <!-- Container -->
 <div :class="s.embed" :style="{ height: containerHeight }">
 <div v-if="loading && resource.embedConfig.container !== 'webcontainer'" role="status" :class="s.placeholder">
 <div :class="s.placeholder">
 <div :class="s.spinner"></div>
 <p :class="s.description">Loading application...</p>
 </div>
 </div>

 <!-- WebContainer -->
 <WebContainerEmbed
 v-if="isOpen && resource.embedConfig.container === 'webcontainer'"
 :title="resource.title"
 :files="resource.embedConfig.files || {}"
 :start-command="resource.embedConfig.startCommand"
 :class="s.fill"
 />

 <!-- Generic iframe -->
 <iframe
 v-else-if="isOpen"
 :src="resource.embedConfig.src"
 :title="resource.title"
 :style="{ width: '100%', height: '100%' }"
 frameborder="0"
 allowfullscreen
 @load="loading = false"
 ></iframe>
 </div>

 <!-- Footer -->
 <div :class="s.toolbar">
 <p v-if="resource.description" :class="s.description">
 {{ resource.description }}
 </p>
 <div :class="s.actions">
 <a
 v-if="resource.embedConfig.container !== 'webcontainer'"
 :href="getExternalUrl()"
 target="_blank"
 rel="noopener noreferrer"
 :class="layout.buttonSecondary"
 >
 Open in new tab
 <svg :class="s.smallIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 </a>
 </div>
 </div>
 </Dialog.Content>
 </Dialog.Positioner>
 </Teleport>
 </Dialog.Root>
</template>

<script setup lang="ts">
import { academyCourse, dialog, academyLayout } from "@rawkodeacademy/design-system";
const s = academyCourse();
const modal = dialog({ tone: "academy", size: "lg" });
const layout = academyLayout();
import { Dialog } from "@ark-ui/vue/dialog";
import { ref, computed, watch } from "vue";
import WebContainerEmbed from "./WebContainerEmbed.vue";

interface EmbedResource {
	title: string;
	description?: string | undefined;
	type: "embed";
	embedConfig: {
		container: "webcontainer" | "iframe";
		src: string;
		height?: string | undefined;
		width?: string | undefined;
		files?: Record<string, string> | undefined;
		import?: {
			localDir: string;
		} | undefined;
		startCommand?: string | undefined;
	};
}

const props = defineProps<{
	resource: EmbedResource;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
}>();

const loading = ref(true);

const isOpen = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value),
});

const containerHeight = computed(() => {
	return props.resource.embedConfig.height || "600px";
});

const getExternalUrl = () => {
	const config = props.resource.embedConfig;
	switch (config.container) {
		case "webcontainer":
			return "#"; // WebContainers don't have external URLs
		default:
			return config.src;
	}
};

watch(isOpen, (value) => {
	if (value) {
		loading.value = true;
	}
});
</script>
