<template>
 <Teleport to="body">
 <Transition
 enter-active-class="transition-opacity duration-200"
 leave-active-class="transition-opacity duration-200"
 enter-from-class="opacity-0"
 leave-to-class="opacity-0"
 >
 <div
 v-if="isOpen"
 class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
 @click.self="close"
 >
 <div
 class="relative w-full max-w-6xl bg-[var(--surface-card)] rounded-sm border border-[var(--surface-border)]"
 @click.stop
 >
 <!-- Header -->
 <div class="flex items-center justify-between p-4 border-b border-[var(--surface-border)] ">
 <h3 class="text-lg font-semibold text-primary-content">
 {{ resource.title }}
 </h3>
 <button
 @click="close"
 class="p-2 text-muted hover:text-secondary-content transition-smooth rounded-sm hover:bg-[var(--surface-card-muted)] hover:"
 aria-label="Close"
 >
 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <!-- Container -->
 <div class="relative bg-[var(--surface-card-muted)]" :style="{ height: containerHeight }">
 <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
 <div class="text-center">
 <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--surface-border-strong)] border-t-primary"></div>
 <p class="mt-2 text-sm text-muted">Loading application...</p>
 </div>
 </div>

 <!-- WebContainer -->
 <WebContainerEmbed
 v-if="resource.embedConfig.container === 'webcontainer'"
 :title="resource.title"
 :files="resource.embedConfig.files || {}"
 :start-command="resource.embedConfig.startCommand"
 class="w-full h-full"
 />

 <!-- Generic iframe -->
 <iframe
 v-else
 :src="resource.embedConfig.src"
 :style="{ width: '100%', height: '100%' }"
 frameborder="0"
 allowfullscreen
 @load="loading = false"
 ></iframe>
 </div>

 <!-- Footer -->
 <div class="flex items-center justify-between p-4 border-t border-[var(--surface-border)] bg-[var(--surface-card-muted)] ">
 <p v-if="resource.description" class="text-sm text-muted">
 {{ resource.description }}
 </p>
 <div class="flex items-center gap-2">
 <a
 v-if="resource.embedConfig.container !== 'webcontainer'"
 :href="getExternalUrl()"
 target="_blank"
 rel="noopener noreferrer"
 class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-content bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-sm hover:bg-[var(--surface-card-muted)] hover:scale-105 transition-smooth shadow-md hover:"
 >
 Open in new tab
 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 </a>
 </div>
 </div>
 </div>
 </div>
 </Transition>
 </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import WebContainerEmbed from "./WebContainerEmbed.vue";

interface EmbedResource {
	title: string;
	description?: string;
	type: "embed";
	embedConfig: {
		container: "webcontainer" | "iframe";
		src: string;
		height?: string;
		width?: string;
		files?: Record<string, string>;
		import?: {
			localDir: string;
		};
		startCommand?: string;
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

const close = () => {
	isOpen.value = false;
};

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
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}
});
</script>