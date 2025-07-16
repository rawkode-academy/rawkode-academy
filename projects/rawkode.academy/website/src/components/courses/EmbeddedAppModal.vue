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
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        @click.self="close"
        style="isolation: isolate;"
      >
        <div
          class="relative w-full max-w-6xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-base font-medium text-gray-900 dark:text-white">
              {{ resource.title }}
            </h3>
            <button
              @click="close"
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <!-- StackBlitz -->
            <iframe
              v-if="resource.embedConfig.container === 'stackblitz'"
              :src="getStackBlitzUrl()"
              :style="{ width: '100%', height: '100%' }"
              frameborder="0"
              @load="loading = false"
            ></iframe>

            <!-- CodeSandbox -->
            <iframe
              v-else-if="resource.embedConfig.container === 'codesandbox'"
              :src="getCodeSandboxUrl()"
              :style="{ width: '100%', height: '100%' }"
              sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              frameborder="0"
              @load="loading = false"
            ></iframe>

            <!-- CodePen -->
            <iframe
              v-else-if="resource.embedConfig.container === 'codepen'"
              :src="getCodePenUrl()"
              :style="{ width: '100%', height: '100%' }"
              frameborder="0"
              scrolling="no"
              allowfullscreen
              @load="loading = false"
            ></iframe>

            <!-- WebContainer -->
            <WebContainerEmbed
              v-else-if="resource.embedConfig.container === 'webcontainer'"
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
          <div class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <p v-if="resource.description" class="text-sm text-gray-600 dark:text-gray-400">
              {{ resource.description }}
            </p>
            <div class="flex items-center gap-2">
              <a
                v-if="resource.embedConfig.container !== 'webcontainer'"
                :href="getExternalUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
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
import { ref, computed, watch } from 'vue';
import WebContainerEmbed from './WebContainerEmbed.vue';

interface EmbedResource {
  title: string;
  description?: string;
  type: 'embed';
  embedConfig: {
    container: 'stackblitz' | 'codesandbox' | 'codepen' | 'iframe' | 'webcontainer';
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
  'update:modelValue': [value: boolean];
}>();

const loading = ref(true);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const containerHeight = computed(() => {
  return props.resource.embedConfig.height || '600px';
});

const close = () => {
  isOpen.value = false;
};

const getStackBlitzUrl = () => {
  const src = props.resource.embedConfig.src;
  try {
    const url = new URL(src);
    if (url.hostname !== 'stackblitz.com') {
      throw new Error('Invalid hostname');
    }
    return src.replace('/edit/', '/embed/');
  } catch {
    // If not a valid URL or wrong hostname, treat as project ID
    return `https://stackblitz.com/embed/${src}?embed=1`;
  }
};

const getCodeSandboxUrl = () => {
  const src = props.resource.embedConfig.src;
  try {
    const url = new URL(src);
    if (url.hostname !== 'codesandbox.io') {
      throw new Error('Invalid hostname');
    }
    return src.replace('/s/', '/embed/');
  } catch {
    // If not a valid URL or wrong hostname, treat as sandbox ID
    return `https://codesandbox.io/embed/${src}`;
  }
};

const getCodePenUrl = () => {
  const src = props.resource.embedConfig.src;
  try {
    const url = new URL(src);
    if (url.hostname !== 'codepen.io') {
      throw new Error('Invalid hostname');
    }
    return src.replace('/pen/', '/embed/');
  } catch {
    // If not a valid URL, return as-is (CodePen doesn't have a predictable embed pattern)
    return src;
  }
};

const getExternalUrl = () => {
  const config = props.resource.embedConfig;
  switch (config.container) {
    case 'stackblitz':
      try {
        const url = new URL(config.src);
        return url.hostname === 'stackblitz.com' ? config.src : `https://stackblitz.com/edit/${config.src}`;
      } catch {
        return `https://stackblitz.com/edit/${config.src}`;
      }
    case 'codesandbox':
      try {
        const url = new URL(config.src);
        return url.hostname === 'codesandbox.io' ? config.src : `https://codesandbox.io/s/${config.src}`;
      } catch {
        return `https://codesandbox.io/s/${config.src}`;
      }
    case 'codepen':
      return config.src;
    case 'webcontainer':
      return '#'; // WebContainers don't have external URLs
    default:
      return config.src;
  }
};

watch(isOpen, (value) => {
  if (value) {
    loading.value = true;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>