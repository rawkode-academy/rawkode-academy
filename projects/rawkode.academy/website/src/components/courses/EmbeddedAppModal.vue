<template>
	<DialogRoot
		:open="modelValue"
		@open-change="handleOpenChange"
	>
		<Teleport to="body">
			<DialogBackdrop :class="backdropStyles" />
			<DialogPositioner :class="positionerStyles">
				<DialogContent :class="contentStyles">
					<!-- Header -->
					<div :class="headerStyles">
						<DialogTitle :class="titleStyles">
							{{ resource.title }}
						</DialogTitle>
						<DialogCloseTrigger :class="closeButtonStyles" aria-label="Close">
							<svg :class="closeIconStyles" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</DialogCloseTrigger>
					</div>

					<!-- Container -->
					<div :class="containerStyles" :style="{ height: containerHeight }">
						<div v-if="loading" :class="loadingOverlayStyles">
							<div :class="loadingInnerStyles">
								<div :class="spinnerStyles"></div>
								<p :class="loadingTextStyles">Loading application...</p>
							</div>
						</div>

						<!-- WebContainer -->
						<WebContainerEmbed
							v-if="resource.embedConfig.container === 'webcontainer'"
							:title="resource.title"
							:files="resource.embedConfig.files || {}"
							:start-command="resource.embedConfig.startCommand"
							:class="fullSizeStyles"
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
					<div :class="footerStyles">
						<DialogDescription v-if="resource.description" :class="descriptionStyles">
							{{ resource.description }}
						</DialogDescription>
						<div :class="footerActionsStyles">
							<a
								v-if="resource.embedConfig.container !== 'webcontainer'"
								:href="getExternalUrl()"
								target="_blank"
								rel="noopener noreferrer"
								:class="externalLinkStyles"
							>
								Open in new tab
								<svg :class="externalLinkIconStyles" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</a>
						</div>
					</div>
				</DialogContent>
			</DialogPositioner>
		</Teleport>
	</DialogRoot>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { DialogRoot, DialogBackdrop, DialogPositioner, DialogContent, DialogTitle, DialogDescription, DialogCloseTrigger } from "@ark-ui/vue/dialog";
import WebContainerEmbed from "./WebContainerEmbed.vue";
import { css } from "../../../styled-system/css";

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

const containerHeight = computed(() => {
	return props.resource.embedConfig.height || "600px";
});

const handleOpenChange = (details: { open: boolean }) => {
	emit("update:modelValue", details.open);
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

watch(() => props.modelValue, (value) => {
	if (value) {
		loading.value = true;
	}
});

const backdropStyles = css({
	position: "fixed",
	inset: "0",
	zIndex: "50",
	bg: "rgba(0,0,0,0.7)",
	backdropFilter: "blur(16px)",
	transition: "opacity",
	transitionDuration: "200ms",
});

const positionerStyles = css({
	position: "fixed",
	inset: "0",
	zIndex: "50",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	p: "4",
	overflowY: "auto",
});

const contentStyles = css({
	position: "relative",
	w: "full",
	maxW: "6xl",
	bg: { base: "rgba(255,255,255,0.9)", _dark: "rgba(17,24,39,0.9)" },
	backdropFilter: "blur(24px)",
	rounded: "xl",
	shadow: "2xl",
	borderWidth: "1px",
	borderColor: { base: "rgba(255,255,255,0.5)", _dark: "rgba(55,65,81,0.5)" },
});

const headerStyles = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	p: "4",
	borderBottomWidth: "1px",
	borderColor: { base: "rgba(255,255,255,0.3)", _dark: "rgba(55,65,81,0.5)" },
	backdropFilter: "blur(12px)",
});

const titleStyles = css({
	fontSize: "lg",
	fontWeight: "semibold",
	color: { base: "gray.900", _dark: "white" },
});

const closeButtonStyles = css({
	p: "2",
	color: { base: "gray.500", _dark: "gray.400" },
	transition: "all",
	transitionDuration: "200ms",
	rounded: "lg",
	cursor: "pointer",
	_hover: {
		color: { base: "gray.700", _dark: "gray.200" },
		bg: { base: "rgba(255,255,255,0.6)", _dark: "rgba(55,65,81,0.6)" },
		backdropFilter: "blur(12px)",
	},
});

const closeIconStyles = css({ w: "5", h: "5" });

const containerStyles = css({
	position: "relative",
	bg: { base: "gray.50", _dark: "gray.800" },
});

const loadingOverlayStyles = css({
	position: "absolute",
	inset: "0",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

const loadingInnerStyles = css({ textAlign: "center" });

const spinnerStyles = css({
	display: "inline-block",
	animation: "spin 1s linear infinite",
	rounded: "full",
	h: "8",
	w: "8",
	borderWidth: "4px",
	borderColor: "gray.300",
	borderTopColor: "primary",
});

const loadingTextStyles = css({
	mt: "2",
	fontSize: "sm",
	color: { base: "gray.600", _dark: "gray.400" },
});

const fullSizeStyles = css({ w: "full", h: "full" });

const footerStyles = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	p: "4",
	borderTopWidth: "1px",
	borderColor: { base: "rgba(255,255,255,0.3)", _dark: "rgba(55,65,81,0.5)" },
	bg: { base: "rgba(255,255,255,0.3)", _dark: "rgba(31,41,55,0.3)" },
	backdropFilter: "blur(12px)",
});

const descriptionStyles = css({
	fontSize: "sm",
	color: { base: "gray.600", _dark: "gray.400" },
});

const footerActionsStyles = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
});

const externalLinkStyles = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "2",
	px: "4",
	py: "2",
	fontSize: "sm",
	fontWeight: "medium",
	color: { base: "gray.700", _dark: "gray.300" },
	bg: { base: "rgba(255,255,255,0.5)", _dark: "rgba(55,65,81,0.5)" },
	backdropFilter: "blur(12px)",
	borderWidth: "1px",
	borderColor: { base: "rgba(255,255,255,0.5)", _dark: "rgba(75,85,99,0.5)" },
	rounded: "xl",
	shadow: "md",
	transition: "all",
	transitionDuration: "200ms",
	_hover: {
		bg: { base: "rgba(255,255,255,0.7)", _dark: "rgba(75,85,99,0.7)" },
		shadow: "lg",
		transform: "scale(1.05)",
	},
});

const externalLinkIconStyles = css({ w: "4", h: "4" });
</script>
