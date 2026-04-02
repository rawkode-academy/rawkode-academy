<template>
	<button
		@click="handleToggle"
		:class="buttonClasses"
		:aria-label="`Change theme (current: ${themeDisplayName})`"
		type="button"
	>
		<!-- Icon for theme -->
		<transition name="fade" mode="out-in">
			<svg
				:key="currentTheme"
				:class="iconStyles"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="12" cy="12" r="10" stroke-width="2" class="stroke-primary" />
				<circle cx="12" cy="12" r="6" fill="currentColor" class="fill-primary" />
			</svg>
		</transition>

		<span v-if="showLabel" :class="labelStyles">
			{{ themeDisplayName }}
		</span>
	</button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import {
	getTheme,
	toggleTheme,
	getThemeDisplayName,
	type Theme,
} from "../../lib/theme";
import { css, cx } from "../../../styled-system/css";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
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

const currentTheme = ref<Theme>("rawkode-green");

const themeDisplayName = computed(() =>
	getThemeDisplayName(currentTheme.value),
);

// Listen for theme changes from other components
const handleThemeChange = (event: Event) => {
	const customEvent = event as CustomEvent<{ theme: Theme }>;
	currentTheme.value = customEvent.detail.theme;
};

onMounted(() => {
	// Initialize theme from storage
	currentTheme.value = getTheme();

	window.addEventListener("theme-change", handleThemeChange);
});

onUnmounted(() => {
	window.removeEventListener("theme-change", handleThemeChange);
});

const handleToggle = () => {
	const previousTheme = currentTheme.value;
	currentTheme.value = toggleTheme();
	// Track theme switch
	trackEvent("theme_switched", {
		from_theme: previousTheme,
		to_theme: currentTheme.value,
		source: "theme_toggle_button",
	});
};

const baseStyles = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	transition: "all",
	transitionDuration: "200ms",
	cursor: "pointer",
	_focus: {
		outline: "2px solid",
		outlineColor: "primary",
		outlineOffset: "2px",
	},
});

const iconVariantStyles = css({
	rounded: "full",
	_hover: {
		bg: { base: "gray.100", _dark: "gray.800" },
	},
});

const buttonVariantStyles = css({
	rounded: "lg",
	borderWidth: "1px",
	borderColor: "border.subtle",
	_hover: {
		bg: { base: "rgba(255,255,255,0.6)", _dark: "rgba(55,65,81,0.7)" },
	},
});

const sizeMap = {
	icon: {
		sm: css({ p: "2" }),
		md: css({ p: "2.5" }),
		lg: css({ p: "3" }),
	},
	button: {
		sm: css({ px: "3", py: "2" }),
		md: css({ px: "4", py: "2.5" }),
		lg: css({ px: "5", py: "3" }),
	},
};

const buttonClasses = computed(() => {
	const variantStyle = props.variant === "icon" ? iconVariantStyles : buttonVariantStyles;
	const sizeStyle = sizeMap[props.variant][props.size];
	return cx(baseStyles, variantStyle, sizeStyle);
});

const iconStyles = css({ w: "5", h: "5" });

const labelStyles = css({
	ml: "2",
	fontSize: "sm",
	fontWeight: "medium",
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
