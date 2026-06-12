<template>
	<button
		@click="handleToggle"
		:class="buttonClasses"
		:aria-label="ariaLabel"
		:title="ariaLabel"
		type="button"
	>
		<transition name="fade" mode="out-in">
			<!-- System (auto) - sun/moon icon -->
			<svg
				v-if="preference === 'system'"
				key="system"
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
				<circle cx="7.75" cy="7.75" r="2.75" />
				<path
					d="M7.75 1.75v1.6M7.75 12.15v1.6M1.75 7.75h1.6M12.15 7.75h1.6M3.55 3.55l1.15 1.15M10.8 10.8l1.15 1.15M3.55 11.95 4.7 10.8M10.8 4.7l1.15-1.15"
				/>
				<path d="M21 15.6a5.9 5.9 0 0 1-8.2 5.43 6.7 6.7 0 0 0 0-10.86A5.9 5.9 0 0 1 21 15.6Z" />
			</svg>

			<!-- Dark - sun icon (clicking moves toward light) -->
			<svg
				v-else-if="preference === 'dark'"
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

			<!-- Light - moon icon (clicking moves toward dark) -->
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
	type ColorSchemePreference,
	getColorSchemePreference,
	toggleColorScheme,
} from "../../lib/theme";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(
			window as { posthog?: { capture: (e: string, p?: unknown) => void } }
		).posthog?.capture(event, properties);
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

const preference = ref<ColorSchemePreference>("system");

const NEXT_DESCRIPTION: Record<ColorSchemePreference, string> = {
	light: "Switch to dark mode",
	dark: "Switch to system theme",
	system: "Switch to light mode",
};

const CURRENT_LABEL: Record<ColorSchemePreference, string> = {
	light: "Light mode",
	dark: "Dark mode",
	system: "Auto theme",
};

const label = computed(() => NEXT_DESCRIPTION[preference.value]);

const ariaLabel = computed(
	() =>
		`${NEXT_DESCRIPTION[preference.value]} (current: ${CURRENT_LABEL[preference.value].toLowerCase()})`,
);

const handlePreferenceChange = (event: Event) => {
	const customEvent = event as CustomEvent<{
		preference: ColorSchemePreference;
		scheme: ColorScheme;
	}>;
	preference.value = customEvent.detail.preference;
};

onMounted(() => {
	preference.value = getColorSchemePreference();
	window.addEventListener("color-scheme-change", handlePreferenceChange);
});

onUnmounted(() => {
	window.removeEventListener("color-scheme-change", handlePreferenceChange);
});

const handleToggle = () => {
	const previous = preference.value;
	preference.value = toggleColorScheme();
	trackEvent("color_scheme_switched", {
		from_preference: previous,
		to_preference: preference.value,
		source: "theme_toggle_button",
	});
};

const buttonClasses = computed(() => {
	const baseClasses =
		"inline-flex items-center justify-center transition-smooth focus-ring";

	const variantClasses = {
		icon: "rounded-full hover:bg-[var(--surface-card-muted)]",
		button:
			"rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-card-muted)]",
	};

	const sizeClasses = {
		sm: props.variant === "button" ? "px-3 py-2" : "p-2",
		// p-3 + 20px icon = 44px hit area for the default icon toggle.
		md: props.variant === "button" ? "px-4 py-2.5 min-h-11" : "p-3",
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
