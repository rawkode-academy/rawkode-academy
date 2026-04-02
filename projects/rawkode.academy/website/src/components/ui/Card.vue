<template>
	<component
		:is="tag"
		:href="href"
		:class="cardClass"
		v-bind="$attrs"
	>
		<!-- Badge overlay (top-left) -->
		<div v-if="$slots.badge" :class="badgeOverlayClass">
			<slot name="badge" />
		</div>

		<!-- Media/Cover slot -->
		<div v-if="$slots.media" :class="mediaWrapperClass">
			<slot name="media" />
			<!-- Overlay slot (for gradients over media) -->
			<div v-if="$slots.overlay" :class="overlayClass">
				<slot name="overlay" />
			</div>
		</div>

		<!-- Header slot -->
		<div v-if="$slots.header" :class="headerClass">
			<slot name="header" />
		</div>

		<!-- Main content -->
		<div :class="contentClass">
			<slot />
		</div>

		<!-- Footer slot -->
		<div v-if="$slots.footer" :class="footerClass">
			<slot name="footer" />
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";
import { paddingValues, roundedValues } from "./tokens";

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

const shadowValues: Record<string, string> = {
	none: "none",
	sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
	md: "0 8px 32px 0 rgba(0, 0, 0, 0.12)",
	lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
	elevated: "0 12px 40px 0 rgba(0, 0, 0, 0.18)",
};

const variantStyles: Record<string, Record<string, unknown>> = {
	glass: {
		backgroundColor: "rgba(255, 255, 255, 0.4)",
		backdropFilter: "blur(40px)",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "rgba(255, 255, 255, 0.4)",
		_dark: {
			backgroundColor: "rgba(31, 41, 55, 0.6)",
			borderColor: "rgba(75, 85, 99, 0.5)",
		},
	},
	solid: {
		backgroundColor: "white",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "{colors.gray.200}",
		_dark: {
			backgroundColor: "{colors.gray.800}",
			borderColor: "{colors.gray.700}",
		},
	},
	gradient: {
		background: "linear-gradient(135deg, rgba(var(--brand-primary), 0.05) 0%, rgba(var(--brand-secondary), 0.03) 100%)",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "rgba(255, 255, 255, 0.4)",
		_dark: {
			background: "linear-gradient(135deg, rgba(var(--brand-primary), 0.1) 0%, rgba(var(--brand-secondary), 0.05) 100%)",
			borderColor: "rgba(75, 85, 99, 0.5)",
		},
	},
	bordered: {
		backgroundColor: "transparent",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "rgba(255, 255, 255, 0.5)",
		_dark: {
			borderColor: "rgba(107, 114, 128, 0.6)",
		},
	},
	flat: {
		backgroundColor: "{colors.gray.50}",
		_dark: {
			backgroundColor: "{colors.gray.900}",
		},
	},
};

const cardClass = computed(() => {
	const base = css({
		position: "relative",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		height: "100%",
		borderRadius: roundedValues[props.rounded],
		boxShadow: shadowValues[props.shadow],
		...variantStyles[props.variant],
		...(props.hover
			? {
					transition: "all 0.3s",
					cursor: "pointer",
					_hover: {
						backgroundColor: "rgba(255, 255, 255, 0.6)",
						transform: "scale(1.02)",
						boxShadow: "0 12px 40px 0 rgba(0, 0, 0, 0.18)",
						_dark: {
							backgroundColor: "rgba(55, 65, 81, 0.7)",
							boxShadow: "0 12px 40px 0 rgba(0, 0, 0, 0.7)",
						},
					},
				}
			: {}),
	});

	return cx(base, props.class);
});

const badgeOverlayClass = css({
	position: "absolute",
	top: "0.75rem",
	left: "0.75rem",
	zIndex: 20,
});

const mediaWrapperClass = css({
	position: "relative",
});

const overlayClass = css({
	position: "absolute",
	inset: 0,
});

const headerClass = computed(() =>
	css({ padding: paddingValues[props.headerPadding] }),
);

const contentClass = computed(() =>
	css({
		padding: paddingValues[props.padding],
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
	}),
);

const footerClass = computed(() =>
	css({
		padding: paddingValues[props.footerPadding],
		marginTop: "auto",
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: "rgba(255, 255, 255, 0.2)",
		_dark: {
			borderTopColor: "rgba(75, 85, 99, 0.3)",
		},
	}),
);
</script>
