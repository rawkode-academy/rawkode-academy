<template>
	<section :class="sectionClasses">
		<!-- Background decorations -->
		<div v-if="background !== 'none'" class="absolute inset-0 pointer-events-none">
			<!-- Gradient overlay -->
			<div v-if="background === 'gradient'" :class="gradientClass"></div>

			<!-- Editorial design has no blur-blob backdrops. Kept as a
			     no-op for backwards compatibility with pages that pass
			     `background="blobs"`. -->
			<template v-if="background === 'blobs'"></template>

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

					<!-- Editorial kicker — mono uppercase label with optional
					     leading §-mark. Replaces the legacy rounded Badge pill. -->
					<div v-if="$slots.badge || badge" class="mb-4">
						<slot name="badge">
							<span v-if="badge" class="hero-kicker">§ {{ badge }}</span>
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
					<div v-if="$slots.stats || (stats && stats.length > 0)" class="flex flex-wrap items-center justify-center gap-6 text-sm text-muted">
						<slot name="stats">
							<template v-if="stats">
								<div v-for="(stat, index) in stats" :key="index" class="flex items-center gap-2">
									<component v-if="stat.icon" :is="stat.icon" class="w-5 h-5" />
									<span>{{ stat.label }}</span>
								</div>
							</template>
						</slot>
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

		<!-- Editorial design has no wave decoration. Kept as a no-op for
		     backwards compatibility with pages that pass `wave={true}`. -->
		<template v-if="wave"></template>
	</section>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import Heading from "../common/Heading.vue";

interface Stat {
	icon?: Component;
	label: string;
}

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
	stats?: Stat[];
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
			"bg-[var(--surface-card)]",
		"gradient-hero": "bg-[var(--surface-base)]",
		"gradient-hero-alt": "bg-[var(--surface-base)]",
		blobs: "bg-[var(--surface-base)]",
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
	return "absolute inset-0 bg-[var(--surface-card)]";
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
/* Brand-tinted grid pattern - uses currentColor so it inherits the active brand-primary
   when the parent sets `color: rgb(var(--brand-primary))`. */
.bg-grid-pattern {
	color: rgb(var(--brand-primary));
	background-image:
		linear-gradient(currentColor 1px, transparent 1px),
		linear-gradient(90deg, currentColor 1px, transparent 1px);
	background-size: 48px 48px;
	background-position: -1px -1px;
}

.bg-dots-pattern {
	color: rgb(var(--brand-primary));
	background-image: radial-gradient(circle, currentColor 1px, transparent 1px);
	background-size: 20px 20px;
}

.hero-kicker {
	display: inline-block;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.6875rem;
	font-weight: 500;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--editorial-spruce);
}
</style>
