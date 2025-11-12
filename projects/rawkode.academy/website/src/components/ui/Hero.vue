<template>
	<section :class="sectionClasses">
		<!-- Background decorations -->
		<div v-if="background !== 'none'" class="absolute inset-0 pointer-events-none">
			<!-- Gradient overlay -->
			<div v-if="background === 'gradient'" :class="gradientClass"></div>

			<!-- Blob decorations -->
			<div v-if="background === 'blobs'" class="absolute inset-0">
				<div class="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 dark:bg-secondary/20 rounded-full opacity-20 blur-3xl"></div>
				<div class="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 dark:bg-primary/20 rounded-full opacity-20 blur-3xl"></div>
			</div>

			<!-- Grid pattern -->
			<div v-if="pattern === 'grid'" class="absolute inset-0 bg-grid-pattern opacity-5"></div>

			<!-- Dots pattern -->
			<div v-if="pattern === 'dots'" class="absolute inset-0 bg-dots-pattern opacity-10"></div>

			<!-- Custom background slot -->
			<slot name="background" />
		</div>

		<!-- Content container -->
		<div :class="containerClasses">
			<div :class="layoutClasses">
				<!-- Left/Main content -->
				<div :class="contentAreaClasses">
					<!-- Breadcrumb -->
					<div v-if="$slots.breadcrumb" class="mb-6">
						<slot name="breadcrumb" />
					</div>

					<!-- Badge -->
					<div v-if="$slots.badge || badge" class="mb-4">
						<slot name="badge">
							<Badge v-if="badge" :variant="badgeVariant" size="md">{{ badge }}</Badge>
						</slot>
					</div>

					<!-- Title -->
					<Heading
						:as="titleTag"
						:size="titleSize"
						:align="align"
						weight="extrabold"
						class="mb-6"
					>
						<slot name="title">{{ title }}</slot>
					</Heading>

					<!-- Subtitle -->
					<p v-if="subtitle || $slots.subtitle" :class="subtitleClasses">
						<slot name="subtitle">{{ subtitle }}</slot>
					</p>

					<!-- Actions -->
					<div v-if="$slots.actions" :class="actionsClasses">
						<slot name="actions" />
					</div>

					<!-- Stats/Metadata -->
					<div v-if="$slots.stats" class="flex flex-wrap items-center gap-6 text-sm text-muted">
						<slot name="stats" />
					</div>

					<!-- Custom content -->
					<div v-if="$slots.default" class="mt-8">
						<slot />
					</div>
				</div>

				<!-- Right/Media content (for split layout) -->
				<div v-if="layout === 'split' && $slots.media" class="relative">
					<slot name="media" />
				</div>
			</div>
		</div>

		<!-- Bottom wave decoration -->
		<div v-if="wave" class="absolute bottom-0 left-0 right-0">
			<svg
				class="w-full h-8 md:h-16 text-white dark:text-gray-800"
				preserveAspectRatio="none"
				viewBox="0 0 1440 64"
				fill="currentColor"
			>
				<path d="M0,32L48,37.3C96,43,192,53,288,56C384,59,480,53,576,48C672,43,768,37,864,32C960,27,1056,21,1152,21.3C1248,21,1344,27,1392,29.3L1440,32L1440,64L1392,64C1344,64,1248,64,1152,64C1056,64,960,64,864,64C768,64,672,64,576,64C480,64,384,64,288,64C192,64,96,64,48,64L0,64Z"></path>
			</svg>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Badge from "../common/Badge.vue";
import Heading from "../common/Heading.vue";

interface Props {
	layout?: "centered" | "split" | "full-width";
	background?:
		| "none"
		| "gradient"
		| "gradient-hero"
		| "gradient-hero-alt"
		| "blobs";
	pattern?: "none" | "grid" | "dots";
	size?: "sm" | "md" | "lg" | "xl";
	align?: "left" | "center" | "right";
	titleTag?: "h1" | "h2" | "h3";
	titleSize?: "xl" | "2xl" | "3xl" | "4xl";
	title?: string;
	subtitle?: string;
	badge?: string;
	badgeVariant?:
		| "default"
		| "primary"
		| "secondary"
		| "success"
		| "warning"
		| "danger"
		| "info";
	wave?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	layout: "centered",
	background: "gradient-hero",
	pattern: "none",
	size: "lg",
	align: "center",
	titleTag: "h1",
	titleSize: "4xl",
	badgeVariant: "primary",
	wave: false,
});

const sectionClasses = computed(() => {
	const baseClasses = "relative overflow-hidden";

	const backgroundClasses: Record<string, string> = {
		none: "",
		gradient:
			"bg-gradient-to-br from-primary/10 via-white to-secondary/10 dark:from-primary/20 dark:via-gray-900 dark:to-secondary/20",
		"gradient-hero": "bg-gradient-hero",
		"gradient-hero-alt": "bg-gradient-hero-alt",
		blobs:
			"bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800",
	};

	return [baseClasses, backgroundClasses[props.background], props.class]
		.filter(Boolean)
		.join(" ");
});

const containerClasses = computed(() => {
	const sizeClasses: Record<string, string> = {
		sm: "py-8 px-4 md:py-12",
		md: "py-12 px-4 md:py-16 lg:py-20",
		lg: "py-16 px-4 md:py-20 lg:py-24",
		xl: "py-20 px-4 md:py-24 lg:py-32",
	};

	return ["relative z-10 container mx-auto", sizeClasses[props.size]].join(" ");
});

const layoutClasses = computed(() => {
	const layoutStyles: Record<string, string> = {
		centered: "max-w-4xl mx-auto text-center",
		split: "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center",
		"full-width": "w-full",
	};

	return layoutStyles[props.layout];
});

const contentAreaClasses = computed(() => {
	if (props.layout === "centered") {
		return "";
	}
	return "flex flex-col justify-center";
});

const gradientClass = computed(() => {
	return "absolute inset-0 bg-gradient-to-br from-primary/10 via-white to-secondary/10 dark:from-primary/20 dark:via-gray-900 dark:to-secondary/20";
});

const subtitleClasses = computed(() => {
	const sizeClasses: Record<string, string> = {
		sm: "text-base md:text-lg",
		md: "text-lg md:text-xl",
		lg: "text-xl md:text-2xl",
		xl: "text-xl md:text-2xl lg:text-3xl",
	};

	const alignClasses: Record<string, string> = {
		left: "text-left",
		center: "text-center",
		right: "text-right",
	};

	return [
		"text-secondary-content leading-relaxed mb-8",
		sizeClasses[props.size],
		alignClasses[props.align],
	].join(" ");
});

const actionsClasses = computed(() => {
	const alignClasses: Record<string, string> = {
		left: "justify-start",
		center: "justify-center",
		right: "justify-end",
	};

	return ["flex flex-wrap gap-4 mb-8", alignClasses[props.align]].join(" ");
});
</script>

<style scoped>
.bg-grid-pattern {
	background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.bg-dots-pattern {
	background-image: radial-gradient(circle, currentColor 1px, transparent 1px);
	background-size: 20px 20px;
}
</style>
