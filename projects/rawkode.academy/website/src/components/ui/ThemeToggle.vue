<template>
	<button
		@click="handleToggle"
		:class="buttonClasses"
		:aria-label="`Switch to ${currentTheme === 'rawkode-green' ? 'blue' : 'green'} theme`"
		type="button"
	>
		<!-- Icon for current theme -->
		<transition name="fade" mode="out-in">
			<svg
				v-if="currentTheme === 'rawkode-green'"
				key="green"
				class="w-5 h-5"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="12" cy="12" r="10" stroke-width="2" class="stroke-primary" />
				<circle cx="12" cy="12" r="6" fill="currentColor" class="fill-primary" />
			</svg>
			<svg
				v-else
				key="blue"
				class="w-5 h-5"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="12" cy="12" r="10" stroke-width="2" class="stroke-primary" />
				<circle cx="12" cy="12" r="6" fill="currentColor" class="fill-primary" />
			</svg>
		</transition>

		<span v-if="showLabel" class="ml-2 text-sm font-medium">
			{{ currentTheme === "rawkode-green" ? "Green" : "Blue" }}
		</span>
	</button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { getTheme, toggleTheme, type Theme } from "../../lib/theme";

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
	currentTheme.value = toggleTheme();
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
