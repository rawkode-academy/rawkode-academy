<template>
	<component
		:is="tag"
		:href="href"
		:class="cardClasses"
		v-bind="$attrs"
	>
		<!-- Badge overlay (top-left) -->
		<div v-if="$slots.badge" :class="css({ position: 'absolute', top: '3', left: '3', zIndex: 20 })">
			<slot name="badge" />
		</div>

		<!-- Media/Cover slot -->
		<div v-if="$slots.media" :class="css({ position: 'relative' })">
			<slot name="media" />
			<!-- Overlay slot (for gradients over media) -->
			<div v-if="$slots.overlay" :class="css({ position: 'absolute', inset: '0' })">
				<slot name="overlay" />
			</div>
		</div>

		<!-- Header slot -->
		<div v-if="$slots.header" :class="headerClasses">
			<slot name="header" />
		</div>

		<!-- Main content -->
		<div :class="contentClasses">
			<slot />
		</div>

		<!-- Footer slot -->
		<div v-if="$slots.footer" :class="footerClasses">
			<slot name="footer" />
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";

interface Props {
	variant?: "glass" | "solid" | "gradient" | "bordered" | "flat";
	padding?: "none" | "sm" | "md" | "lg";
	rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
	shadow?: "none" | "sm" | "md" | "lg" | "elevated";
	hover?: boolean;
	href?: string;
	headerPadding?: "none" | "sm" | "md" | "lg";
	footerPadding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "glass",
	padding: "md",
	rounded: "xl",
	shadow: "md",
	hover: true,
	headerPadding: "md",
	footerPadding: "md",
});

const tag = computed(() => (props.href ? "a" : "div"));

const baseStyles = css({
	position: "relative",
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
	height: "full",
});

const variantStyles = {
	glass: cx(
		"glass-card",
		css({ backdropFilter: "blur(40px)" }),
	),
	solid: css({
		bg: { base: "white", _dark: "gray.800" },
		border: "1px solid",
		borderColor: { base: "gray.200", _dark: "gray.700" },
	}),
	gradient: cx(
		"bg-gradient-card",
		css({ border: "1px solid", borderColor: "var(--surface-border)" }),
	),
	bordered: css({
		bg: "transparent",
		border: "1px solid",
		borderColor: "var(--surface-border-strong)",
	}),
	flat: css({ bg: { base: "gray.50", _dark: "gray.900" } }),
};

const paddingStyles = {
	none: css({ p: "0" }),
	sm: css({ p: "3" }),
	md: css({ p: "6" }),
	lg: css({ p: "8" }),
};

const roundedStyles = {
	none: css({ borderRadius: "none" }),
	sm: css({ borderRadius: "sm" }),
	md: css({ borderRadius: "md" }),
	lg: css({ borderRadius: "lg" }),
	xl: css({ borderRadius: "xl" }),
	"2xl": css({ borderRadius: "2xl" }),
	"3xl": css({ borderRadius: "3xl" }),
};

const shadowStyles = {
	none: "",
	sm: css({ shadow: "sm" }),
	md: css({ boxShadow: "var(--surface-shadow)" }),
	lg: css({ shadow: "lg" }),
	elevated: css({ boxShadow: "var(--surface-shadow-strong)" }),
};

const cardClasses = computed(() => {
	return cx(
		baseStyles,
		variantStyles[props.variant],
		roundedStyles[props.rounded],
		shadowStyles[props.shadow],
		props.hover
			? css({
					cursor: "pointer",
					transition: "all",
					transitionDuration: "300ms",
					_hover: { transform: "translateY(-2px)", boxShadow: "var(--surface-shadow-strong)" },
				})
			: undefined,
		props.class,
	);
});

const headerClasses = computed(() => {
	return paddingStyles[props.headerPadding];
});

const contentClasses = computed(() => {
	return cx(paddingStyles[props.padding], css({ display: "flex", flexDirection: "column", flexGrow: 1 }));
});

const footerClasses = computed(() => {
	return cx(
		paddingStyles[props.footerPadding],
		css({
			mt: "auto",
			borderTop: "1px solid",
			borderColor: { base: "rgba(255, 255, 255, 0.2)", _dark: "rgba(107, 114, 128, 0.5)" },
		}),
	);
});
</script>
