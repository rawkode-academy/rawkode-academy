<template>
	<!--
		Deprecated alias of HairlinePanel. Editorial design uses flat paper
		surfaces with 1px hairlines, no backdrop-blur, no depth shadows.
		The component remains so existing call-sites keep rendering;
		`blur` and `shadow` props are accepted-but-ignored. Migrate to
		HairlinePanel in new code. Will be removed in Phase 4.
	-->
	<div :class="panelClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

interface Props {
	variant?: "light" | "medium" | "dark";
	/** @deprecated editorial design has no blur; prop is accepted but ignored */
	blur?: "sm" | "md" | "lg" | "xl" | "2xl";
	padding?: "none" | "sm" | "md" | "lg" | "xl";
	rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
	border?: boolean;
	shadow?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "medium",
	blur: "xl",
	padding: "md",
	rounded: "2xl",
	border: true,
	shadow: false,
});

if (import.meta.env.DEV) {
	onMounted(() => {
		console.warn(
			"[deprecation] GlassPanel is a thin alias of HairlinePanel post-rebrand. Prefer HairlinePanel for new code; this component will be removed in Phase 4.",
		);
	});
}

const variantClasses = {
	light: "bg-[var(--editorial-paper)]",
	medium: "bg-[var(--editorial-paper-deep)]",
	dark: "bg-[var(--surface-card-muted)]",
};

const paddingClasses = {
	none: "p-0",
	sm: "p-4",
	md: "p-6",
	lg: "p-8",
	xl: "p-10",
};

const roundedClasses = {
	none: "rounded-none",
	sm: "rounded-sm",
	md: "rounded-md",
	lg: "rounded-lg",
	xl: "rounded-xl",
	"2xl": "rounded-2xl",
	"3xl": "rounded-3xl",
};

const panelClasses = computed(() => {
	return [
		"relative",
		variantClasses[props.variant],
		paddingClasses[props.padding],
		roundedClasses[props.rounded],
		props.border && "border border-[var(--editorial-hairline)]",
		props.shadow && "card-shadow",
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
