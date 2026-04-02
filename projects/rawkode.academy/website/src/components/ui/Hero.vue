<template>
	<section :class="sectionClass">
		<!-- Background decorations -->
		<div v-if="background !== 'none'" :class="bgDecorationClass">
			<!-- Gradient overlay -->
			<div v-if="background === 'gradient'" :class="gradientOverlayClass"></div>

			<!-- Blob decorations -->
			<div v-if="background === 'blobs'" :class="blobContainerClass">
				<div :class="blobPrimaryClass"></div>
				<div :class="blobSecondaryClass"></div>
			</div>

			<!-- Grid pattern -->
			<div v-if="pattern === 'grid'" class="bg-grid-pattern" :class="patternGridClass"></div>

			<!-- Dots pattern -->
			<div v-if="pattern === 'dots'" class="bg-dots-pattern" :class="patternDotsClass"></div>

			<!-- Custom background slot -->
			<slot name="background" />
		</div>

		<!-- Content container -->
		<div :class="containerClass">
			<div :class="layoutClass">
				<!-- Left/Main content -->
				<div :class="contentAreaClass">
					<!-- Breadcrumb -->
					<div v-if="$slots.breadcrumb" :class="breadcrumbClass">
						<slot name="breadcrumb" />
					</div>

					<!-- Badge -->
					<div v-if="$slots.badge || badge" :class="badgeContainerClass">
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
						:class="titleClass"
					>
						<slot name="title">{{ title }}</slot>
					</Heading>

					<!-- Subtitle -->
					<p v-if="subtitle || $slots.subtitle" :class="subtitleClass">
						<slot name="subtitle">{{ subtitle }}</slot>
					</p>

					<!-- Actions -->
					<div v-if="$slots.actions" :class="actionsClass">
						<slot name="actions" />
					</div>

					<!-- Stats/Metadata -->
					<div v-if="$slots.stats || (stats && stats.length > 0)" :class="statsClass">
						<slot name="stats">
							<template v-if="stats">
								<div v-for="(stat, index) in stats" :key="index" :class="statItemClass">
									<component v-if="stat.icon" :is="stat.icon" :class="statIconClass" />
									<span>{{ stat.label }}</span>
								</div>
							</template>
						</slot>
					</div>

					<!-- Custom content -->
					<div v-if="$slots.default" :class="customContentClass">
						<slot />
					</div>
				</div>

				<!-- Right/Media content (for split layout) -->
				<div v-if="layout === 'split' && $slots.media" :class="mediaClass">
					<slot name="media" />
				</div>
			</div>
		</div>

		<!-- Bottom wave decoration -->
		<div v-if="wave" :class="waveContainerClass">
			<svg
				:class="waveSvgClass"
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
import { css, cx } from "../../../styled-system/css";
import Badge from "../common/Badge.vue";
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

const backgroundStyles: Record<string, Record<string, unknown>> = {
	none: {},
	gradient: {
		backgroundImage: "linear-gradient(to bottom right, rgba(var(--brand-primary), 0.1), white, rgba(var(--brand-secondary), 0.1))",
		_dark: {
			backgroundImage: "linear-gradient(to bottom right, rgba(var(--brand-primary), 0.2), var(--colors-gray-900), rgba(var(--brand-secondary), 0.2))",
		},
	},
	"gradient-hero": {
		backgroundImage: "linear-gradient(to bottom right, var(--colors-gray-50, #f9fafb), var(--colors-gray-100, #f3f4f6), var(--colors-gray-200, #e5e7eb))",
		_dark: {
			backgroundImage: "linear-gradient(to bottom right, var(--colors-gray-900, #111827), var(--colors-gray-800, #1f2937), black)",
		},
	},
	"gradient-hero-alt": {
		backgroundImage: "linear-gradient(to bottom, var(--colors-gray-50, #f9fafb), white)",
		_dark: {
			backgroundImage: "linear-gradient(to bottom, var(--colors-gray-900, #111827), var(--colors-gray-800, #1f2937))",
		},
	},
	blobs: {
		backgroundImage: "linear-gradient(to bottom, var(--colors-gray-50, #f9fafb), white)",
		_dark: {
			backgroundImage: "linear-gradient(to bottom, var(--colors-gray-900, #111827), var(--colors-gray-800, #1f2937))",
		},
	},
};

const sectionClass = computed(() => {
	const base = css({
		position: "relative",
		overflow: "hidden",
		...backgroundStyles[props.background],
	});
	return cx(base, props.class);
});

const bgDecorationClass = css({
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
});

const gradientOverlayClass = css({
	position: "absolute",
	inset: 0,
	backgroundImage: "linear-gradient(to bottom right, rgba(var(--brand-primary), 0.1), white, rgba(var(--brand-secondary), 0.1))",
	_dark: {
		backgroundImage: "linear-gradient(to bottom right, rgba(var(--brand-primary), 0.2), var(--colors-gray-900, #111827), rgba(var(--brand-secondary), 0.2))",
	},
});

const blobContainerClass = css({
	position: "absolute",
	inset: 0,
});

const blobPrimaryClass = css({
	position: "absolute",
	top: 0,
	left: "25%",
	width: "24rem",
	height: "24rem",
	backgroundColor: "rgba(var(--brand-secondary), 0.2)",
	borderRadius: "9999px",
	opacity: 0.2,
	filter: "blur(48px)",
});

const blobSecondaryClass = css({
	position: "absolute",
	bottom: 0,
	right: "25%",
	width: "24rem",
	height: "24rem",
	backgroundColor: "rgba(var(--brand-primary), 0.2)",
	borderRadius: "9999px",
	opacity: 0.2,
	filter: "blur(48px)",
});

const patternGridClass = css({
	position: "absolute",
	inset: 0,
	opacity: 0.05,
});

const patternDotsClass = css({
	position: "absolute",
	inset: 0,
	opacity: 0.1,
});

const sizeValues: Record<string, Record<string, unknown>> = {
	sm: {
		paddingBlock: "2rem",
		paddingInline: "1rem",
		md: { paddingBlock: "3rem" },
	},
	md: {
		paddingBlock: "3rem",
		paddingInline: "1rem",
		md: { paddingBlock: "4rem" },
		lg: { paddingBlock: "5rem" },
	},
	lg: {
		paddingBlock: "4rem",
		paddingInline: "1rem",
		md: { paddingBlock: "5rem" },
		lg: { paddingBlock: "6rem" },
	},
	xl: {
		paddingBlock: "5rem",
		paddingInline: "1rem",
		md: { paddingBlock: "6rem" },
		lg: { paddingBlock: "8rem" },
	},
};

const containerClass = computed(() =>
	css({
		position: "relative",
		zIndex: 10,
		maxWidth: "80rem",
		marginInline: "auto",
		...sizeValues[props.size],
	}),
);

const layoutStyles: Record<string, Record<string, unknown>> = {
	centered: {
		maxWidth: "56rem",
		marginInline: "auto",
		textAlign: "center",
	},
	split: {
		display: "grid",
		gridTemplateColumns: "1fr",
		gap: "3rem",
		alignItems: "center",
		lg: {
			gridTemplateColumns: "1fr 1fr",
		},
	},
	"full-width": {
		width: "100%",
	},
};

const layoutClass = computed(() => css(layoutStyles[props.layout]));

const contentAreaClass = computed(() => {
	if (props.layout === "centered") {
		return "";
	}
	return css({
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
	});
});

const breadcrumbClass = css({ marginBottom: "1.5rem" });

const badgeContainerClass = css({ marginBottom: "1rem" });

const titleClass = css({ marginBottom: "1.5rem" });

const subtitleSizeStyles: Record<string, Record<string, unknown>> = {
	sm: {
		fontSize: "1rem",
		md: { fontSize: "1.125rem" },
	},
	md: {
		fontSize: "1.125rem",
		md: { fontSize: "1.25rem" },
	},
	lg: {
		fontSize: "1.25rem",
		md: { fontSize: "1.5rem" },
	},
	xl: {
		fontSize: "1.25rem",
		md: { fontSize: "1.5rem" },
		lg: { fontSize: "1.875rem" },
	},
};

const textAlignMap: Record<string, string> = {
	left: "left",
	center: "center",
	right: "right",
};

const subtitleClass = computed(() =>
	css({
		color: "{colors.gray.700}",
		lineHeight: 1.625,
		marginBottom: "2rem",
		textAlign: textAlignMap[props.align],
		_dark: {
			color: "{colors.gray.300}",
		},
		...subtitleSizeStyles[props.size],
	}),
);

const justifyAlignMap: Record<string, string> = {
	left: "flex-start",
	center: "center",
	right: "flex-end",
};

const actionsClass = computed(() =>
	css({
		display: "flex",
		flexWrap: "wrap",
		gap: "1rem",
		marginBottom: "2rem",
		justifyContent: justifyAlignMap[props.align],
	}),
);

const statsClass = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "center",
	gap: "1.5rem",
	fontSize: "0.875rem",
	color: "{colors.gray.600}",
	_dark: {
		color: "{colors.gray.400}",
	},
});

const statItemClass = css({
	display: "flex",
	alignItems: "center",
	gap: "0.5rem",
});

const statIconClass = css({
	width: "1.25rem",
	height: "1.25rem",
});

const customContentClass = css({ marginTop: "2rem" });

const mediaClass = css({ position: "relative" });

const waveContainerClass = css({
	position: "absolute",
	bottom: 0,
	left: 0,
	right: 0,
});

const waveSvgClass = css({
	width: "100%",
	height: "2rem",
	color: "white",
	md: { height: "4rem" },
	_dark: {
		color: "{colors.gray.800}",
	},
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
