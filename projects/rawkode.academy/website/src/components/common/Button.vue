<template>
 <component
 :is="tag"
 :href="href"
 :type="!href ? type : undefined"
 :disabled="!href ? disabled : undefined"
 :class="buttonClasses"
 v-bind="$attrs"
 >
 <slot name="icon-left" />
 <slot />
 <slot name="icon-right" />
 </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	href?: string;
	type?: "button" | "submit" | "reset";
	disabled?: boolean;
	fullWidth?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "primary",
	size: "md",
	type: "button",
	disabled: false,
	fullWidth: false,
});

const tag = computed(() => (props.href ? "a" : "button"));

// Editorial button — mono uppercase, hairline borders, no shadow/scale.
// Prefer `EditorialButton.vue` (ui/) for greenfield code; this stays for
// the long tail of legacy `<Button>` consumers.
const baseClasses =
	"inline-flex items-center justify-center gap-2 font-mono font-semibold uppercase tracking-[0.14em] rounded-[2px] transition-colors-smooth focus-ring";

const variantClasses = {
	primary:
		"bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border border-[var(--editorial-ink)] hover:opacity-92",
	secondary:
		"bg-transparent text-[var(--text-primary-content)] border border-[var(--editorial-hairline-strong)] hover:border-[var(--editorial-ink)]",
	ghost:
		"bg-transparent text-[var(--text-primary-content)] border border-transparent hover:bg-[var(--surface-card-muted)]",
	danger:
		"bg-[var(--editorial-rust)] text-[var(--editorial-paper)] border border-[var(--editorial-rust)] hover:opacity-92",
};

const sizeClasses = {
	sm: "text-[11px] px-3.5 py-2",
	md: "text-xs px-5 py-3",
	lg: "text-[13px] px-6 py-3.5",
};

const buttonClasses = computed(() => {
	const classes = [
		baseClasses,
		variantClasses[props.variant],
		sizeClasses[props.size],
		props.disabled && "opacity-50 cursor-not-allowed",
		props.fullWidth && "w-full",
		props.class,
	].filter(Boolean);

	return classes.join(" ");
});
</script>
