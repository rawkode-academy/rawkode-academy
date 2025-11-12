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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl overflow-y-auto"
        @click.self="close"
      >
        <div
          class="relative w-full max-w-6xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-xl shadow-[0_24px_64px_0_rgba(0,0,0,0.3)] dark:shadow-[0_24px_64px_0_rgba(0,0,0,0.6)] border border-white/50 dark:border-gray-700/50"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-white/30 dark:border-gray-700/50 backdrop-blur-md">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ resource.title }}
            </h3>
            <button
              @click="close"
              class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-200 rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/60 hover:backdrop-blur-md"
              aria-label="Close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Container -->
          <div class="relative bg-gray-50 dark:bg-gray-800" :style="{ height: containerHeight }">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-primary"></div>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading application...</p>
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
          <div class="flex items-center justify-between p-4 border-t border-white/30 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/30 backdrop-blur-md">
            <p v-if="resource.description" class="text-sm text-gray-600 dark:text-gray-400">
              {{ resource.description }}
            </p>
            <div class="flex items-center gap-2">
              <a
                v-if="resource.embedConfig.container !== 'webcontainer'"
                :href="getExternalUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white/50 dark:bg-gray-700/50 backdrop-blur-md border border-white/50 dark:border-gray-600/50 rounded-xl hover:bg-white/70 dark:hover:bg-gray-600/70 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
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