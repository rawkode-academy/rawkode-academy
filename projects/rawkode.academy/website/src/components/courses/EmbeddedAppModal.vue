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
        :class="overlayStyle"
        @click.self="close"
      >
        <div
          :class="modalStyle"
          @click.stop
        >
          <!-- Header -->
          <div :class="headerStyle">
            <h3 :class="titleStyle">
              {{ resource.title }}
            </h3>
            <button
              @click="close"
              :class="closeBtnStyle"
              aria-label="Close"
            >
              <svg :class="iconSmStyle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Container -->
          <div :class="containerStyle" :style="{ height: containerHeight }">
            <div v-if="loading" :class="loadingStyle">
              <div :class="loadingInnerStyle">
                <div :class="spinnerStyle"></div>
                <p :class="loadingTextStyle">Loading application...</p>
              </div>
            </div>

            <!-- WebContainer -->
            <WebContainerEmbed
              v-if="resource.embedConfig.container === 'webcontainer'"
              :title="resource.title"
              :files="resource.embedConfig.files || {}"
              :start-command="resource.embedConfig.startCommand"
              :class="fullStyle"
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
          <div :class="footerStyle">
            <p v-if="resource.description" :class="descStyle">
              {{ resource.description }}
            </p>
            <div :class="footerActionsStyle">
              <a
                v-if="resource.embedConfig.container !== 'webcontainer'"
                :href="getExternalUrl()"
                target="_blank"
                rel="noopener noreferrer"
                :class="extLinkStyle"
              >
                Open in new tab
                <svg :class="iconXsStyle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
import { css } from "styled-system/css";

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

const overlayStyle = css({ position: 'fixed', inset: '0', zIndex: '50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '4', bg: 'black/70', backdropFilter: 'blur(16px)', overflowY: 'auto' });
const modalStyle = css({ position: 'relative', w: 'full', maxW: '6xl', bg: { base: 'white/90', _dark: 'gray.900/90' }, backdropFilter: 'blur(40px)', borderRadius: 'xl', shadow: '2xl', borderWidth: '1px', borderColor: { base: 'white/50', _dark: 'gray.700/50' } });
const headerStyle = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', borderBottomWidth: '1px', borderColor: { base: 'white/30', _dark: 'gray.700/50' }, backdropFilter: 'blur(12px)' });
const titleStyle = css({ fontSize: 'lg', fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' } });
const closeBtnStyle = css({ p: '2', color: { base: 'gray.500', _dark: 'gray.400' }, transition: 'all', transitionDuration: '200ms', borderRadius: 'lg', _hover: { color: { base: 'gray.700', _dark: 'gray.200' }, bg: { base: 'white/60', _dark: 'gray.700/60' }, backdropFilter: 'blur(12px)' } });
const iconSmStyle = css({ w: '5', h: '5' });
const containerStyle = css({ position: 'relative', bg: { base: 'gray.50', _dark: 'gray.800' } });
const loadingStyle = css({ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const loadingInnerStyle = css({ textAlign: 'center' });
const spinnerStyle = css({ display: 'inline-block', animation: 'spin 1s linear infinite', borderRadius: 'full', h: '8', w: '8', borderWidth: '4px', borderColor: 'gray.300', borderTopColor: 'brandAccent.text' });
const loadingTextStyle = css({ mt: '2', fontSize: 'sm', color: { base: 'gray.600', _dark: 'gray.400' } });
const fullStyle = css({ w: 'full', h: 'full' });
const footerStyle = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', borderTopWidth: '1px', borderColor: { base: 'white/30', _dark: 'gray.700/50' }, bg: { base: 'white/30', _dark: 'gray.800/30' }, backdropFilter: 'blur(12px)' });
const descStyle = css({ fontSize: 'sm', color: { base: 'gray.600', _dark: 'gray.400' } });
const footerActionsStyle = css({ display: 'flex', alignItems: 'center', gap: '2' });
const extLinkStyle = css({ display: 'inline-flex', alignItems: 'center', gap: '2', px: '4', py: '2', fontSize: 'sm', fontWeight: 'medium', color: { base: 'gray.700', _dark: 'gray.300' }, bg: { base: 'white/50', _dark: 'gray.700/50' }, backdropFilter: 'blur(12px)', borderWidth: '1px', borderColor: { base: 'white/50', _dark: 'gray.600/50' }, borderRadius: 'xl', shadow: 'md', transition: 'all', transitionDuration: '200ms', _hover: { bg: { base: 'white/70', _dark: 'gray.600/70' }, transform: 'scale(1.05)', shadow: 'lg' } });
const iconXsStyle = css({ w: '4', h: '4' });
</script>
