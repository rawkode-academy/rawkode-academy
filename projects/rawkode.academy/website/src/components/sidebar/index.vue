<script setup lang="ts">
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/vue/20/solid";
import {
	AcademicCapIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	CubeIcon,
	DocumentTextIcon,
	InformationCircleIcon,
	NewspaperIcon,
	RocketLaunchIcon,
	TvIcon,
	VideoCameraIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import MenuItems from "./items.vue";

// Get the current path from the window location
const currentPath = ref("");

// Sidebar open state for mobile
const sidebarOpen = ref(false);

// Collapsible section states
const sectionsExpanded = ref({
	community: false,
});

onMounted(() => {
	currentPath.value = window.location.pathname;

	// Auto-expand sections if they contain the current page
	if (
		currentPath.value.startsWith("/community-day") ||
		currentPath.value.includes("chat.rawkode")
	) {
		sectionsExpanded.value.community = true;
	}

	// Listen for toggle events from navbar
	window.addEventListener("toggle-sidebar", () => {
		sidebarOpen.value = !sidebarOpen.value;
	});
});

// Toggle section expansion
const toggleSection = (section: keyof typeof sectionsExpanded.value) => {
	sectionsExpanded.value[section] = !sectionsExpanded.value[section];
};

// Main navigation - core learning content
const baseMenuItemsMain = [
        { name: "Articles", href: "/read", icon: NewspaperIcon },
        { name: "Videos", href: "/watch", icon: VideoCameraIcon },
        { name: "Shows", href: "/shows", icon: TvIcon },
        { name: "Courses", href: "/courses", icon: AcademicCapIcon },
        { name: "Technologies", href: "/technology", icon: CubeIcon },
];

// Community items
const baseMenuItemsCommunity = [
	{ name: "Community Day", href: "/community-day", icon: CalendarIcon },
	{
		name: "Zulip Chat",
		href: "https://chat.rawkode.academy",
		icon: ChatBubbleLeftEllipsisIcon,
		target: "_blank",
	},
];

// Footer items - always visible at bottom
const baseMenuItemsFooter = [
	{ name: "About", href: "/about", icon: InformationCircleIcon },
	{ name: "Changelog", href: "/changelog", icon: ClockIcon },
];

const baseMenuItemsOrgs = [
	{
		name: "Partnerships",
		href: "/organizations/partnerships",
		icon: RocketLaunchIcon,
	},
	{
		name: "Consulting",
		href: "/organizations/consulting",
		icon: WrenchScrewdriverIcon,
	},
	{
		name: "Training",
		href: "/organizations/training",
		icon: AcademicCapIcon,
	},
];

// Compute the menu items with the current property based on the current path
const menuItemsMain = computed(() => {
	return baseMenuItemsMain.map((item) => ({
		...item,
		current: isCurrentPath(item.href),
	}));
});

const menuItemsCommunity = computed(() => {
	return baseMenuItemsCommunity.map((item) => ({
		...item,
		current: isCurrentPath(item.href),
	}));
});

const menuItemsFooter = computed(() => {
	return baseMenuItemsFooter.map((item) => ({
		...item,
		current: isCurrentPath(item.href),
	}));
});

const menuItemsOrgs = computed(() => {
	return baseMenuItemsOrgs.map((item) => ({
		...item,
		current: isCurrentPath(item.href),
	}));
});

// Helper function to check if a path matches the current path
function isCurrentPath(itemPath: string) {
	// Special case for home page
	if (itemPath === "/" && currentPath.value === "/") {
		return true;
	}

	// For other pages, check if the current path starts with the item path
	// This handles nested routes (e.g. /read/some-post should highlight the article)
	return itemPath !== "/" && currentPath.value.startsWith(itemPath);
}
</script>

<template>
	<aside 
		:class="[
			'fixed top-0 left-0 z-40 w-64 h-screen pt-14 transition-transform',
			sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
			'bg-linear-to-br from-white to-gray-50 dark:from-black dark:to-gray-900',
			'border-r border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-100/10 dark:shadow-black/20'
		]"
		aria-label="Sidenav">
		<div class="overflow-y-auto py-5 px-4 h-full flex flex-col">

			<!-- Main navigation - always visible -->
			<ul class="space-y-1.5">
				<MenuItems :menuItems="menuItemsMain" />
			</ul>
			
			<!-- For Organizations - promoted and always visible -->
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-linear-to-r from-primary to-tertiary">
					For Organizations
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsOrgs" />
				</ul>
			</div>
			
			<!-- Community - Accordion -->
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<button 
					@click="toggleSection('community')"
					class="flex items-center justify-between w-full px-2 py-2 mb-2 text-xs font-semibold leading-6 
					       text-left cursor-pointer transition-all duration-200 rounded-lg
					       hover:bg-gray-100 dark:hover:bg-gray-800 
					       focus:outline-none focus:ring-2 focus:ring-primary/50
					       border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
					<span class="bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary">Community</span>
					<ChevronRightIcon 
						class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200"
						:class="{ 'rotate-90': sectionsExpanded.community }"
					/>
				</button>
				<Transition
					enter-active-class="transition-all duration-300 ease-out"
					enter-from-class="transform -translate-y-2 opacity-0 max-h-0"
					enter-to-class="transform translate-y-0 opacity-100 max-h-32"
					leave-active-class="transition-all duration-200 ease-in"
					leave-from-class="transform translate-y-0 opacity-100 max-h-32"
					leave-to-class="transform -translate-y-2 opacity-0 max-h-0">
					<div v-show="sectionsExpanded.community" class="overflow-hidden">
						<ul class="space-y-1.5 pb-2">
							<MenuItems :menuItems="menuItemsCommunity" />
						</ul>
					</div>
				</Transition>
			</div>
			
			<!-- Spacer to push footer items to bottom -->
			<div class="flex-1"></div>
			
			<!-- Footer items - always visible at bottom -->
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsFooter" />
				</ul>
			</div>
		</div>
	</aside>
</template>
