<template>
	<button
		@click="handleToggle"
		:class="buttonClasses"
		:aria-label="ariaLabel"
		type="button"
	>
		<transition name="fade" mode="out-in">
			<svg
				v-if="scheme === 'dark'"
				key="sun"
				class="w-5 h-5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="4" />
				<path
					d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
				/>
			</svg>
			<svg
				v-else
				key="moon"
				class="w-5 h-5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
			</svg>
		</transition>

		<span v-if="showLabel" class="ml-2 text-sm font-medium">
			{{ label }}
		</span>
	</button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
	type ColorScheme,
	getColorScheme,
	toggleColorScheme,
} from "../../lib/theme";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as { posthog?: { capture: (e: string, p?: unknown) => void } })
			.posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface Props {
	showLabel?: boolean;
	variant?: "icon" | "button";
	size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
	showLabel: false,
	variant: "icon",
	size: "md",
});

const scheme = ref<ColorScheme>("light");

const label = computed(() =>
	scheme.value === "dark" ? "Switch to light mode" : "Switch to dark mode",
);

const ariaLabel = computed(() =>
	scheme.value === "dark"
		? "Switch to light mode (current: dark)"
		: "Switch to dark mode (current: light)",
);

const handleSchemeChange = (event: Event) => {
	const customEvent = event as CustomEvent<{ scheme: ColorScheme }>;
	scheme.value = customEvent.detail.scheme;
};

onMounted(() => {
	scheme.value = getColorScheme();
	window.addEventListener("color-scheme-change", handleSchemeChange);
});

onUnmounted(() => {
	window.removeEventListener("color-scheme-change", handleSchemeChange);
});

const handleToggle = () => {
	const previous = scheme.value;
	scheme.value = toggleColorScheme();
	trackEvent("color_scheme_switched", {
		from_scheme: previous,
		to_scheme: scheme.value,
		source: "theme_toggle_button",
	});
};

const buttonClasses = computed(() => {
	const baseClasses =
		"inline-flex items-center justify-center transition-smooth focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

	const variantClasses = {
		icon: "rounded-full hover:bg-gray-100 dark:hover:bg-gray-800",
		button:
			"rounded-lg border border-glass hover:bg-white/60 dark:hover:bg-gray-700/70",
	};

	const sizeClasses = {
		sm: props.variant === "button" ? "px-3 py-2" : "p-2",
		md: props.variant === "button" ? "px-4 py-2.5" : "p-2.5",
		lg: props.variant === "button" ? "px-5 py-3" : "p-3",
	};

	return [
		baseClasses,
		variantClasses[props.variant],
		sizeClasses[props.size],
	].join(" ");
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
