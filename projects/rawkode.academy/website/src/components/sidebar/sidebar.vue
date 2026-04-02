<script setup lang="ts">
import {
	AcademicCapIcon,
	CubeIcon,
	MapIcon,
	NewspaperIcon,
	TvIcon,
	VideoCameraIcon,
	UsersIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import NavItem from "./NavItem.vue";
import type { NavItemData } from "./NavItem.vue";

// Get the current path from the window location
const currentPath = ref("");
const isCollapsed = ref(false);

onMounted(() => {
	currentPath.value = window.location.pathname;

	// Check if we're on mobile (window width < 768px which is md breakpoint)
	const isMobile = window.innerWidth < 768;

	// On mobile, always start collapsed (hidden)
	// On desktop, check localStorage for collapse state
	if (isMobile) {
		isCollapsed.value = true;
	} else {
		const savedState = localStorage.getItem("sidebar-collapsed");
		if (savedState === "true") {
			isCollapsed.value = true;
		}
	}

	// Listen for toggle events from mobile menu button
	window.addEventListener("toggle-sidebar", () => {
		isCollapsed.value = !isCollapsed.value;
		// Only save state on desktop
		if (!isMobile) {
			localStorage.setItem("sidebar-collapsed", String(isCollapsed.value));
		}
	});
});

// Helper function to check if a path matches the current path
function isCurrentPath(itemPath: string) {
	if (itemPath === "/" && currentPath.value === "/") {
		return true;
	}
	return itemPath !== "/" && currentPath.value.startsWith(itemPath);
}

// Navigation items - grouped with separators
const navItems = computed(() => [
	{
		name: "Videos",
		href: "/watch",
		icon: VideoCameraIcon,
		current: isCurrentPath("/watch"),
	},
	{
		name: "Articles",
		href: "/read",
		icon: NewspaperIcon,
		current: isCurrentPath("/read"),
	},
	{ separator: true },
	{
		name: "Learning Paths",
		href: "/learning-paths",
		icon: MapIcon,
		current: isCurrentPath("/learning-paths"),
	},
	{
		name: "Courses",
		href: "/courses",
		icon: AcademicCapIcon,
		current: isCurrentPath("/courses"),
	},
	{ separator: true },
	{
		name: "Shows",
		href: "/shows",
		icon: TvIcon,
		current: isCurrentPath("/shows"),
	},
	{
		name: "People",
		href: "/people",
		icon: UsersIcon,
		current: isCurrentPath("/people"),
	},
	{
		name: "Technologies",
		href: "/technology",
		icon: CubeIcon,
		current: isCurrentPath("/technology"),
		children: [
			{
				name: "Matrix",
				href: "/technology/matrix",
				current:
					isCurrentPath("/technology/matrix") &&
					!isCurrentPath("/technology/matrix/advanced"),
				children: [
					{
						name: "Advanced",
						href: "/technology/matrix/advanced",
						current: isCurrentPath("/technology/matrix/advanced"),
					},
				],
			},
		],
	},
]);

const toggleCollapse = () => {
	isCollapsed.value = !isCollapsed.value;
	localStorage.setItem("sidebar-collapsed", String(isCollapsed.value));
};

const expandSidebar = () => {
	isCollapsed.value = false;
	localStorage.setItem("sidebar-collapsed", "false");
};
</script>

<template>
	<aside
		class="glass-panel"
		:class="[
			'fixed top-28 left-4 md:left-8 bottom-4 z-30 transition-all duration-300 ease-in-out',
			'rounded-2xl',
			// Desktop: always visible, toggles between collapsed/expanded
			// Mobile: hidden by default (collapsed), shows when expanded (!isCollapsed)
			isCollapsed ? 'hidden md:block md:w-[4.5rem]' : 'block w-64',
		]"
		aria-label="Sidebar navigation"
	>
		<div class="absolute inset-0 bg-gradient-to-br from-white/60 via-primary/10 to-transparent dark:from-gray-900/60 dark:via-primary/20 opacity-70 pointer-events-none rounded-2xl" />
		<div class="flex flex-col h-full relative z-10">
			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto py-4 px-3 scroll-fade">
				<ul :class="['space-y-1', isCollapsed ? 'space-y-0.5 pr-1' : '']">
					<template v-for="(item, index) in navItems" :key="'href' in item ? item.href : `sep-${index}`">
						<!-- Separator -->
						<li v-if="item.separator" :class="isCollapsed ? 'py-1' : 'py-2'">
							<div class="border-t border-gray-200/50 dark:border-gray-700/50 mx-2"></div>
						</li>
						<!-- Navigation Item -->
						<li v-else>
							<NavItem
								:item="item as NavItemData"
								:isCollapsed="isCollapsed"
								@expand="expandSidebar"
							/>
						</li>
					</template>
				</ul>
			</nav>
		</div>
	</aside>

	<!-- Mobile Overlay -->
	<div
		v-show="!isCollapsed"
		class="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 md:hidden"
		@click="toggleCollapse"
		aria-label="Close sidebar"
	></div>
</template>

<style scoped>
/* Subtle fade at top/bottom to hint scrollability */
.scroll-fade {
	-webkit-mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
	mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
}
</style>
