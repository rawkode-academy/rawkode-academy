<template>
	<button
		type="button"
		:aria-label="ariaLabel"
		:title="ariaLabel"
		@click="onToggle"
		:class="rootClass"
	>
		<svg
			v-if="mode === 'dark'"
			:class="iconClass"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="5" />
			<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
		</svg>
		<svg
			v-else
			:class="iconClass"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
		</svg>
		<span v-if="showLabel" class="theme-toggle-label">{{ label }}</span>
	</button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { css, cx } from "../../../styled-system/css";
import { getMode, toggleMode, type Mode } from "@/lib/theme";

const props = withDefaults(
	defineProps<{
		showLabel?: boolean;
		variant?: "icon" | "button";
		size?: "sm" | "md" | "lg";
	}>(),
	{ showLabel: false, variant: "icon", size: "md" },
);

const mode = ref<Mode>("dark");
const label = computed(() => (mode.value === "dark" ? "Light mode" : "Dark mode"));
const ariaLabel = computed(() => `Switch to ${label.value.toLowerCase()}`);

const onModeChange = (event: Event) => {
	const detail = (event as CustomEvent<{ mode: Mode }>).detail;
	if (detail?.mode) {
		mode.value = detail.mode;
	}
};

onMounted(() => {
	mode.value = getMode();
	window.addEventListener("mode-change", onModeChange);
});

onBeforeUnmount(() => {
	window.removeEventListener("mode-change", onModeChange);
});

const onToggle = () => {
	mode.value = toggleMode();
};

const rootClass = computed(() =>
	cx(
		css({
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "2",
			borderRadius: "full",
			color: "fg.muted",
			transition: "all 150ms ease",
			cursor: "pointer",
			outline: "none",
			_hover: { color: "fg.brand", bg: "bg.surface" },
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "border.focus",
				outlineOffset: "2px",
			},
		}),
		props.variant === "button"
			? css({
					border: "1px solid",
					borderColor: "border.default",
					_hover: { borderColor: "border.strong" },
				})
			: undefined,
		props.size === "sm"
			? css({ padding: props.variant === "button" ? "1.5" : "1" })
			: props.size === "lg"
				? css({ padding: props.variant === "button" ? "3" : "2.5" })
				: css({ padding: props.variant === "button" ? "2" : "2" }),
	),
);

const iconClass = computed(() =>
	css({
		width: props.size === "sm" ? "4" : props.size === "lg" ? "6" : "5",
		height: props.size === "sm" ? "4" : props.size === "lg" ? "6" : "5",
	}),
);
</script>

<style scoped>
.theme-toggle-label {
	font-size: 0.875rem;
	font-weight: 500;
}
</style>
