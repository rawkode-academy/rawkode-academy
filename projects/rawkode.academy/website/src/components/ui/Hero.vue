<template>
	<section :class="sectionClasses">
		<!-- Background decorations -->
		<div v-if="background !== 'none'" :class="css({ position: 'absolute', inset: '0', pointerEvents: 'none' })">
			<!-- Gradient overlay -->
			<div v-if="background === 'gradient'" :class="gradientClass"></div>

			<!-- Blob decorations -->
			<div v-if="background === 'blobs'" :class="css({ position: 'absolute', inset: '0' })">
				<div :class="css({ position: 'absolute', top: '0', left: '25%', w: '96', h: '96', borderRadius: 'full', opacity: 0.2, filter: 'blur(64px)', bg: 'rgb(var(--brand-secondary) / 0.2)' })"></div>
				<div :class="css({ position: 'absolute', bottom: '0', right: '25%', w: '96', h: '96', borderRadius: 'full', opacity: 0.2, filter: 'blur(64px)', bg: 'rgb(var(--brand-primary) / 0.2)' })"></div>
			</div>

			<!-- Grid pattern -->
			<div v-if="pattern === 'grid'" :class="cx('bg-grid-pattern', css({ position: 'absolute', inset: '0', opacity: 0.05 }))"></div>

			<!-- Dots pattern -->
			<div v-if="pattern === 'dots'" :class="cx('bg-dots-pattern', css({ position: 'absolute', inset: '0', opacity: 0.1 }))"></div>

			<!-- Custom background slot -->
			<slot name="background" />
		</div>

		<!-- Content container -->
		<div :class="containerClasses">
			<div :class="layoutClasses">
				<!-- Left/Main content -->
				<div :class="contentAreaClasses">
					<!-- Breadcrumb -->
					<div v-if="$slots.breadcrumb" :class="css({ mb: '6' })">
						<slot name="breadcrumb" />
					</div>

					<!-- Badge -->
					<div v-if="$slots.badge || badge" :class="css({ mb: '4' })">
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
						:class="css({ mb: '6' })"
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
					<div v-if="$slots.stats || (stats && stats.length > 0)" :class="cx(css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6', fontSize: 'sm' }), 'text-muted')">
						<slot name="stats">
							<template v-if="stats">
								<div v-for="(stat, index) in stats" :key="index" :class="css({ display: 'flex', alignItems: 'center', gap: '2' })">
									<component v-if="stat.icon" :is="stat.icon" :class="css({ w: '5', h: '5' })" />
									<span>{{ stat.label }}</span>
								</div>
							</template>
						</slot>
					</div>

					<!-- Custom content -->
					<div v-if="$slots.default" :class="css({ mt: '8' })">
						<slot />
					</div>
				</div>

				<!-- Right/Media content (for split layout) -->
				<div v-if="layout === 'split' && $slots.media" :class="css({ position: 'relative' })">
					<slot name="media" />
				</div>
			</div>
		</div>

		<!-- Bottom wave decoration -->
		<div v-if="wave" :class="css({ position: 'absolute', bottom: '0', left: '0', right: '0' })">
			<svg
				:class="css({ w: 'full', h: '8', md: { h: '16' }, color: { base: 'white', _dark: 'gray.800' } })"
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
import type { Component } from "vue";
import { computed } from "vue";
import { css, cx } from "styled-system/css";
import Badge from "../common/Badge.vue";
import Heading from "../common/Heading.vue";

interface Stat {
	icon?: Component;
	label: string;
}

interface Props {
	layout?: "centered" | "split" | "full-width";
	background?: "none" | "gradient" | "gradient-hero" | "gradient-hero-alt" | "blobs";
	pattern?: "none" | "grid" | "dots";
	size?: "sm" | "md" | "lg" | "xl";
	align?: "left" | "center" | "right";
	titleTag?: "h1" | "h2" | "h3";
	titleSize?: "xl" | "2xl" | "3xl" | "4xl";
	title?: string;
	subtitle?: string;
	badge?: string;
	badgeVariant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "info";
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
	const backgroundStyles: Record<string, string> = {
		none: "",
		gradient: css({
			backgroundImage: {
				base: "linear-gradient(to bottom right, rgb(var(--brand-primary) / 0.1), white, rgb(var(--brand-secondary) / 0.1))",
				_dark: "linear-gradient(to bottom right, rgb(var(--brand-primary) / 0.2), var(--colors-gray-900), rgb(var(--brand-secondary) / 0.2))",
			},
		}),
		"gradient-hero": css({
			backgroundImage: {
				base: "linear-gradient(to bottom right, oklch(0.985 0.002 247.839) 0%, oklch(0.967 0.003 264.542) 50%, oklch(0.928 0.006 264.531) 100%)",
				_dark: "linear-gradient(145deg, rgb(8 14 31 / 0.92) 0%, rgb(12 20 40 / 0.94) 55%, rgb(17 24 39 / 0.96) 100%)",
			},
		}),
		"gradient-hero-alt": css({
			backgroundImage: {
				base: "linear-gradient(to top left, oklch(0.985 0.002 247.839) 0%, oklch(0.967 0.003 264.542) 50%, oklch(0.928 0.006 264.531) 100%)",
				_dark: "linear-gradient(145deg, rgb(8 14 31 / 0.92) 0%, rgb(12 20 40 / 0.94) 55%, rgb(17 24 39 / 0.96) 100%)",
			},
		}),
		blobs: css({
			backgroundImage: {
				base: "linear-gradient(to bottom, var(--colors-gray-50, #f9fafb), white)",
				_dark: "linear-gradient(to bottom, var(--colors-gray-900, #111827), var(--colors-gray-800, #1f2937))",
			},
		}),
	};

	return cx(
		css({ position: "relative", overflow: "hidden" }),
		backgroundStyles[props.background],
		props.class,
	);
});

const containerClasses = computed(() => {
	const sizeMap: Record<string, Record<string, any>> = {
		sm: { py: "8", px: "4", md: { py: "12" } },
		md: { py: "12", px: "4", md: { py: "16" }, lg: { py: "20" } },
		lg: { py: "16", px: "4", md: { py: "20" }, lg: { py: "24" } },
		xl: { py: "20", px: "4", md: { py: "24" }, lg: { py: "32" } },
	};

	return cx(
		css({ position: "relative", zIndex: 10, mx: "auto", ...sizeMap[props.size] }),
		"container",
	);
});

const layoutClasses = computed(() => {
	const layoutMap: Record<string, string> = {
		centered: css({ maxWidth: "4xl", mx: "auto", textAlign: "center" }),
		split: css({ display: "grid", gridTemplateColumns: { base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: "12", alignItems: "center" }),
		"full-width": css({ w: "full" }),
	};
	return layoutMap[props.layout];
});

const contentAreaClasses = computed(() => {
	if (props.layout === "centered") return "";
	return css({ display: "flex", flexDirection: "column", justifyContent: "center" });
});

const gradientClass = computed(() => {
	return css({
		position: "absolute",
		inset: "0",
		backgroundImage: {
			base: "linear-gradient(to bottom right, rgb(var(--brand-primary) / 0.1), white, rgb(var(--brand-secondary) / 0.1))",
			_dark: "linear-gradient(to bottom right, rgb(var(--brand-primary) / 0.2), var(--colors-gray-900), rgb(var(--brand-secondary) / 0.2))",
		},
	});
});

const subtitleClasses = computed(() => {
	const sizeMap: Record<string, Record<string, any>> = {
		sm: { fontSize: { base: "base", md: "lg" } },
		md: { fontSize: { base: "lg", md: "xl" } },
		lg: { fontSize: { base: "xl", md: "2xl" } },
		xl: { fontSize: { base: "xl", md: "2xl", lg: "3xl" } },
	};

	return cx(
		"text-secondary-content",
		css({ lineHeight: "relaxed", mb: "8", textAlign: props.align, ...sizeMap[props.size] }),
	);
});

const actionsClasses = computed(() => {
	const justifyMap: Record<string, string> = {
		left: "flex-start",
		center: "center",
		right: "flex-end",
	};

	return css({ display: "flex", flexWrap: "wrap", gap: "4", mb: "8", justifyContent: justifyMap[props.align] });
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
