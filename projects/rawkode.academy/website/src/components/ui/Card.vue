<template>
	<component :is="tag" :href="href" :class="classes.root" v-bind="$attrs">
		<div v-if="$slots.badge" :class="badgeWrapClass">
			<slot name="badge" />
		</div>

		<div v-if="$slots.media" :class="mediaWrapClass">
			<slot name="media" />
			<div v-if="$slots.overlay" :class="overlayWrapClass">
				<slot name="overlay" />
			</div>
		</div>

		<div v-if="$slots.header" :class="classes.header">
			<slot name="header" />
		</div>

		<div :class="classes.body">
			<slot />
		</div>

		<div v-if="$slots.footer" :class="classes.footer">
			<slot name="footer" />
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { card } from "../../../styled-system/recipes";
import { css, cx } from "../../../styled-system/css";

const props = withDefaults(
	defineProps<{
		variant?: "elevated" | "glass" | "outline" | "subtle";
		href?: string;
		interactive?: boolean;
	}>(),
	{ variant: "elevated", interactive: false },
);

defineOptions({ inheritAttrs: false });

const tag = computed(() => (props.href ? "a" : "div"));

const variantStyles = {
	elevated: css({
		bg: "bg.surface",
		borderWidth: "1px",
		borderColor: "border.muted",
		boxShadow: "md",
	}),
	glass: css({
		bg: "bg.raised/70",
		borderWidth: "1px",
		borderColor: "border.muted",
		backdropFilter: "auto",
		backdropBlur: "xl",
		boxShadow: "md",
	}),
	outline: css({
		bg: "transparent",
		borderWidth: "1px",
		borderColor: "border.default",
	}),
	subtle: css({
		bg: "bg.sunken",
		borderWidth: "1px",
		borderColor: "transparent",
	}),
} as const;

const interactiveStyles = css({
	transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
	cursor: "pointer",
	_hover: {
		transform: "translateY(-2px)",
		boxShadow: "lg",
		borderColor: "border.default",
	},
	_focusVisible: {
		outline: "2px solid",
		outlineColor: "border.focus",
		outlineOffset: "2px",
	},
});

const classes = computed(() => {
	const slots = card();
	return {
		root: cx(
			slots.root,
			css({
				position: "relative",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				borderRadius: "xl",
				textDecoration: "none",
				color: "fg.primary",
				h: "full",
			}),
			variantStyles[props.variant],
			(props.interactive || !!props.href) && interactiveStyles,
		),
		header: cx(
			slots.header,
			css({ px: "6", pt: "6", pb: "0", display: "flex", flexDir: "column", gap: "1" }),
		),
		body: cx(slots.body, css({ p: "6", display: "flex", flexDir: "column", flex: "1" })),
		footer: cx(
			slots.footer,
			css({
				px: "6",
				py: "4",
				mt: "auto",
				borderTopWidth: "1px",
				borderTopColor: "border.muted",
				display: "flex",
				alignItems: "center",
				gap: "3",
			}),
		),
	};
});

const badgeWrapClass = css({
	position: "absolute",
	top: "3",
	left: "3",
	zIndex: "10",
});

const mediaWrapClass = css({
	position: "relative",
	overflow: "hidden",
	"& > img, & > video, & > picture": { width: "full", height: "auto", display: "block" },
});

const overlayWrapClass = css({ position: "absolute", inset: "0", pointerEvents: "none" });
</script>
