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
				:class="css({ w: '5', h: '5' })"
				fill="none"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle
					cx="12"
					cy="12"
					r="10"
					stroke-width="2"
					style="stroke: rgb(var(--brand-primary));"
				/>
				<circle
					cx="12"
					cy="12"
					r="6"
					stroke-width="1.5"
					style="fill: rgb(var(--brand-primary)); stroke: rgb(var(--brand-accent));"
				/>
			</svg>
		</transition>

		<span v-if="showLabel" :class="css({ ml: '2', fontSize: 'sm', fontWeight: 'medium' })">
			{{ themeDisplayName }}
		</span>
	</button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { css } from "styled-system/css";
import {
	getTheme,
	toggleTheme,
	getThemeDisplayName,
	type Theme,
} from "../../lib/theme";

// Track analytics events client-side
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

const buttonClasses = computed(() => {
	const base = css({
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'all',
		transitionDuration: '200ms',
		_focus: {
			outline: 'none',
			ringWidth: '2px',
			ringColor: 'primary',
			ringOffset: '2px',
		},
	});

	const variantStyles = {
		icon: css({
			borderRadius: 'full',
			_hover: {
				bg: { base: 'gray.100', _dark: 'gray.800' },
			},
		}),
		button: css({
			borderRadius: 'lg',
			borderWidth: '1px',
			borderColor: 'white/40',
			_hover: {
				bg: { base: 'white/60', _dark: 'gray.700/70' },
			},
		}),
	};

	const sizeStyles = {
		sm: props.variant === "button"
			? css({ px: '3', py: '2' })
			: css({ p: '2' }),
		md: props.variant === "button"
			? css({ px: '4', py: '2.5' })
			: css({ p: '2.5' }),
		lg: props.variant === "button"
			? css({ px: '5', py: '3' })
			: css({ p: '3' }),
	};

	return [
		base,
		variantStyles[props.variant],
		sizeStyles[props.size],
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
