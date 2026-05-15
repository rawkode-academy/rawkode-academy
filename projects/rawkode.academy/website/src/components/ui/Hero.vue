<template>
	<section :class="rootClass">
		<div v-if="$slots.background" :class="bgWrapClass">
			<slot name="background" />
		</div>
		<div v-if="pattern !== 'none'" :class="patternClass" aria-hidden="true" />

		<div :class="containerClass">
			<div v-if="layout === 'split'" :class="splitClass">
				<div :class="splitContentClass">
					<slot name="breadcrumb" />
					<div v-if="$slots.badge || badge" :class="badgeRowClass">
						<slot name="badge">
							<Badge :variant="badgeVariant">{{ badge }}</Badge>
						</slot>
					</div>
					<component :is="titleTag" :class="titleClass"><slot name="title">{{ title }}</slot></component>
					<p v-if="$slots.subtitle || subtitle" :class="subtitleClass">
						<slot name="subtitle">{{ subtitle }}</slot>
					</p>
					<div v-if="$slots.actions" :class="actionsClass">
						<slot name="actions" />
					</div>
					<div v-if="$slots.stats" :class="statsClass">
						<slot name="stats" />
					</div>
				</div>
				<div v-if="$slots.media" :class="mediaClass">
					<slot name="media" />
				</div>
			</div>

			<div v-else :class="centeredClass">
				<slot name="breadcrumb" />
				<div v-if="$slots.badge || badge" :class="badgeRowClass">
					<slot name="badge">
						<Badge :variant="badgeVariant">{{ badge }}</Badge>
					</slot>
				</div>
				<component :is="titleTag" :class="titleClass"><slot name="title">{{ title }}</slot></component>
				<p v-if="$slots.subtitle || subtitle" :class="subtitleClass">
					<slot name="subtitle">{{ subtitle }}</slot>
				</p>
				<div v-if="$slots.actions" :class="actionsClass">
					<slot name="actions" />
				</div>
				<div v-if="$slots.stats" :class="statsClass">
					<slot name="stats" />
				</div>
				<slot />
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Badge from "./Badge.vue";
import { css } from "../../../styled-system/css";
import type { BadgeVariantProps } from "../../../styled-system/recipes";

type Layout = "centered" | "split" | "full-width";
type Background = "none" | "gradient" | "gradient-hero" | "gradient-hero-alt" | "blobs";
type Pattern = "none" | "grid" | "dots";
type Size = "sm" | "md" | "lg" | "xl";

const props = withDefaults(
	defineProps<{
		layout?: Layout;
		background?: Background;
		pattern?: Pattern;
		size?: Size;
		align?: "left" | "center" | "right";
		title?: string;
		subtitle?: string;
		titleTag?: "h1" | "h2" | "h3";
		badge?: string;
		badgeVariant?: BadgeVariantProps["variant"];
	}>(),
	{
		layout: "centered",
		background: "gradient-hero",
		pattern: "none",
		size: "lg",
		align: "center",
		titleTag: "h1",
		badgeVariant: "subtle",
	},
);

const sizePadding: Record<Size, string> = {
	sm: "16",
	md: "20",
	lg: "28",
	xl: "36",
};

const titleSize: Record<Size, string> = {
	sm: "3xl",
	md: "4xl",
	lg: "5xl",
	xl: "6xl",
};

const subtitleSize: Record<Size, string> = {
	sm: "md",
	md: "lg",
	lg: "xl",
	xl: "2xl",
};

const rootClass = computed(() =>
	css({
		position: "relative",
		overflow: "hidden",
		py: sizePadding[props.size],
		bg: props.background === "none" ? "transparent" : "bg.canvas",
		backgroundImage:
			props.background === "gradient-hero"
				? "linear-gradient(135deg, token(colors.brand.50) 0%, token(colors.bg.canvas) 60%, token(colors.cyan.50) 100%)"
				: props.background === "gradient-hero-alt"
				? "linear-gradient(135deg, token(colors.bg.canvas) 0%, token(colors.brand.100) 100%)"
				: props.background === "gradient"
				? "brand.subtle"
				: undefined,
		_dark: {
			backgroundImage:
				props.background === "gradient-hero"
					? "linear-gradient(135deg, token(colors.brand.950) 0%, token(colors.bg.canvas) 60%, token(colors.cyan.950) 100%)"
					: props.background === "gradient-hero-alt"
					? "linear-gradient(135deg, token(colors.bg.canvas) 0%, token(colors.brand.900) 100%)"
					: undefined,
		},
	}),
);

const bgWrapClass = css({ position: "absolute", inset: "0", zIndex: "0", pointerEvents: "none" });

const patternClass = computed(() =>
	css({
		position: "absolute",
		inset: "0",
		pointerEvents: "none",
		opacity: "0.4",
		backgroundImage:
			props.pattern === "grid"
				? "linear-gradient(to right, token(colors.border.muted) 1px, transparent 1px), linear-gradient(to bottom, token(colors.border.muted) 1px, transparent 1px)"
				: props.pattern === "dots"
				? "radial-gradient(token(colors.border.muted) 1px, transparent 1px)"
				: undefined,
		backgroundSize: props.pattern === "grid" ? "48px 48px" : "24px 24px",
		maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
	}),
);

const containerClass = computed(() =>
	css({
		position: "relative",
		zIndex: "1",
		maxWidth: "80rem",
		mx: "auto",
		px: { base: "4", lg: "6" },
	}),
);

const splitClass = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" },
	alignItems: "center",
	gap: "12",
});

const splitContentClass = computed(() =>
	css({
		display: "flex",
		flexDirection: "column",
		gap: "5",
		textAlign: props.align,
	}),
);

const centeredClass = computed(() =>
	css({
		display: "flex",
		flexDirection: "column",
		gap: "5",
		textAlign: props.align,
		alignItems:
			props.align === "left"
				? "flex-start"
				: props.align === "right"
				? "flex-end"
				: "center",
		maxWidth: "56rem",
		mx: "auto",
	}),
);

const badgeRowClass = computed(() =>
	css({
		display: "flex",
		justifyContent:
			props.align === "left"
				? "flex-start"
				: props.align === "right"
				? "flex-end"
				: "center",
	}),
);

const titleClass = computed(() =>
	css({
		fontFamily: "display",
		fontSize: titleSize[props.size],
		fontWeight: "bold",
		lineHeight: "1.1",
		letterSpacing: "tight",
		color: "fg.primary",
		textWrap: "balance",
	}),
);

const subtitleClass = computed(() =>
	css({
		fontSize: subtitleSize[props.size],
		color: "fg.secondary",
		lineHeight: "1.6",
		maxWidth: "42rem",
		mx: props.align === "center" ? "auto" : undefined,
		textWrap: "pretty",
	}),
);

const actionsClass = computed(() =>
	css({
		display: "flex",
		flexWrap: "wrap",
		gap: "3",
		mt: "2",
		justifyContent:
			props.align === "left"
				? "flex-start"
				: props.align === "right"
				? "flex-end"
				: "center",
	}),
);

const statsClass = computed(() =>
	css({
		display: "flex",
		flexWrap: "wrap",
		gap: "8",
		mt: "6",
		justifyContent:
			props.align === "left"
				? "flex-start"
				: props.align === "right"
				? "flex-end"
				: "center",
	}),
);

const mediaClass = css({
	position: "relative",
	"& img, & video, & picture": {
		width: "full",
		height: "auto",
		borderRadius: "2xl",
		boxShadow: "lg",
	},
});
</script>
