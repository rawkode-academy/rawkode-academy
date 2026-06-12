<template>
	<component
		:is="tag"
		:href="href"
		:type="tag === 'button' ? type : undefined"
		:class="['ed-btn', `ed-btn--${variant}`, `ed-btn--${size}`]"
	>
		<slot name="leading" />
		<slot />
		<slot name="trailing">
			<span v-if="arrow" aria-hidden="true">→</span>
		</slot>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		variant?: "solid" | "outline" | "ghost";
		size?: "sm" | "md" | "lg";
		href?: string;
		type?: "button" | "submit" | "reset";
		arrow?: boolean;
	}>(),
	{ variant: "solid", size: "md", type: "button", arrow: false },
);

const tag = computed(() => (props.href ? "a" : "button"));
</script>

<style scoped>
.ed-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.625rem;
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.14em;
	line-height: 1;
	border-radius: var(--radius-sm);
	border: 1px solid transparent;
	cursor: pointer;
	text-decoration: none;
	transition:
		border-color var(--duration-base) var(--ease-standard),
		background-color var(--duration-base) var(--ease-standard),
		opacity var(--duration-base) var(--ease-standard);
	white-space: nowrap;
}

.ed-btn--sm { padding: 0.6rem 0.95rem; font-size: 0.6875rem; }
.ed-btn--md { padding: 0.85rem 1.25rem; font-size: 0.75rem; min-height: 2.75rem; }
.ed-btn--lg { padding: 1rem 1.5rem;     font-size: 0.8125rem; min-height: 2.75rem; }

/* On coarse pointers the small button keeps its visual density but
   grows to a 44px tap target. */
@media (pointer: coarse) {
	.ed-btn--sm { min-height: 2.75rem; }
}

.ed-btn--solid {
	background: var(--editorial-ink);
	color: var(--editorial-paper);
	border-color: var(--editorial-ink);
}
.ed-btn--solid:hover { opacity: 0.92; }

.ed-btn--outline {
	background: transparent;
	color: var(--text-primary-content);
	border-color: var(--editorial-hairline-strong);
}
.ed-btn--outline:hover { border-color: var(--editorial-ink); }

.ed-btn--ghost {
	background: transparent;
	color: var(--text-primary-content);
}
.ed-btn--ghost:hover { background: var(--surface-card-muted); }

.ed-btn:focus-visible {
	outline: 2px solid var(--editorial-ink);
	outline-offset: 2px;
}
</style>
