<script setup lang="ts">
import { computed } from "vue";
import { button, type ButtonVariants } from "../recipes/button";

const props = withDefaults(
	defineProps<{
		variant?: ButtonVariants["variant"];
		size?: ButtonVariants["size"];
		/** Set to `ink` when the button sits on an ink surface. */
		surface?: ButtonVariants["surface"];
		/** Renders an anchor. Without it the component is a `<button>`. */
		href?: string;
		type?: "button" | "submit" | "reset";
		fullWidth?: boolean;
		/** A square control for one icon. Pass an `aria-label`. */
		icon?: boolean;
		/** Appends a trailing arrow that travels on hover. */
		arrow?: boolean;
		/** The action is in flight: announces busy and blocks a second press. */
		loading?: boolean;
		disabled?: boolean;
	}>(),
	{
		variant: "solid",
		size: "md",
		surface: "canvas",
		href: undefined,
		type: "button",
		fullWidth: false,
		icon: false,
		arrow: false,
		loading: false,
		disabled: false,
	},
);

const classes = computed(() =>
	button({
		variant: props.variant,
		size: props.size,
		surface: props.surface,
		fullWidth: props.fullWidth,
		icon: props.icon,
	}),
);
const blocked = computed(() => props.disabled || props.loading);
// An anchor has no disabled state: a blocked link drops its destination and
// says so, which also takes it out of the tab order.
const linkAttrs = computed(() =>
	blocked.value
		? { role: "link", "aria-disabled": "true" as const }
		: { href: props.href },
);
</script>

<template>
	<a
		v-if="props.href !== undefined"
		v-bind="linkAttrs"
		:class="classes"
		:aria-busy="props.loading || undefined"
	>
		<slot />
		<span v-if="props.arrow" data-part="arrow" aria-hidden="true">→</span>
	</a>
	<button
		v-else
		:type="props.type"
		:class="classes"
		:disabled="blocked"
		:aria-busy="props.loading || undefined"
	>
		<slot />
		<span v-if="props.arrow" data-part="arrow" aria-hidden="true">→</span>
	</button>
</template>
