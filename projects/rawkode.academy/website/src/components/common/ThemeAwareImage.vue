<template>
	<div class="theme-aware-image" :class="className">
		<img
			v-if="!isDark"
			:src="lightSrc"
			:alt="alt"
			:loading="loading"
			class="w-full h-auto"
		/>
		<img
			v-else
			:src="darkSrc"
			:alt="alt"
			:loading="loading"
			class="w-full h-auto"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

interface Props {
	lightSrc: string;
	darkSrc: string;
	alt: string;
	class?: string;
	loading?: "eager" | "lazy";
}

const props = withDefaults(defineProps<Props>(), {
	class: "",
	loading: "lazy",
});

const isDark = ref(false);
const className = props.class;

// Check if dark mode is enabled
const checkDarkMode = () => {
	// Check for dark class on html element
	if (document.documentElement.classList.contains("dark")) {
		isDark.value = true;
		return;
	}

	// Check for data-theme attribute
	const theme = document.documentElement.getAttribute("data-theme");
	if (theme === "dark") {
		isDark.value = true;
		return;
	}

	// Check system preference if no explicit theme is set
	if (
		window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		isDark.value = true;
		return;
	}

	isDark.value = false;
};

// Watch for theme changes
const observer = ref<MutationObserver | null>(null);

onMounted(() => {
	// Initial check
	checkDarkMode();

	// Watch for class changes on html element
	observer.value = new MutationObserver(() => {
		checkDarkMode();
	});

	observer.value.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-theme"],
	});

	// Listen for system theme changes
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	mediaQuery.addEventListener("change", checkDarkMode);

	// Cleanup function for media query listener
	onUnmounted(() => {
		mediaQuery.removeEventListener("change", checkDarkMode);
	});
});

onUnmounted(() => {
	if (observer.value) {
		observer.value.disconnect();
	}
});
</script>

<style scoped>
.theme-aware-image {
	position: relative;
	width: 100%;
	height: auto;
}
</style>