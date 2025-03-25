<script setup lang="ts">
import { initFlowbite } from 'flowbite';
import { onMounted, ref, computed } from 'vue';
import MenuItems from "./items.vue";
import {
	HomeIcon,
	InformationCircleIcon,
	NewspaperIcon,
	// QuestionMarkCircleIcon,
	RocketLaunchIcon,
	VideoCameraIcon,
	CalendarIcon,
	WrenchScrewdriverIcon,
	AcademicCapIcon,
} from "@heroicons/vue/24/outline";
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/20/solid';

// Get the current path from the window location
const currentPath = ref("");

onMounted(() => {
	currentPath.value = window.location.pathname;
	initFlowbite();
});

// Create menu items array without the current property
const baseMenuItems = [
	{ name: "Home", href: "/", icon: HomeIcon },
	// {
	// 	name: "Live",
	// 	href: "/live",
	// 	icon: FilmIcon,
	// },
	{ name: "Blog", href: "/blog", icon: NewspaperIcon },
	// { name: 'Events', href: '/events', icon: CalendarDaysIcon },
	// { name: 'Courses', href: '#', icon: AcademicCapIcon },
	// { name: 'Shows', href: '#', icon: FilmIcon },
	{
		name: "Watch",
		href: "/watch",
		icon: VideoCameraIcon,
	},
	{
		name: "Community Day",
		href: "/community-day",
		icon: CalendarIcon,
	},
	{
		name: "Zulip Chat",
		href: "https://chat.rawkode.academy",
		icon: ChatBubbleLeftEllipsisIcon,
		target: "_blank",
	},
	{
		name: "About",
		href: "/about",
		icon: InformationCircleIcon,
	},
	// { name: 'Help', href: '/help', icon: QuestionMarkCircleIcon },
];

const baseMenuItemsMaintainers = [
	{
		name: "Share Your Project",
		href: "/maintainers/share-your-project",
		icon: RocketLaunchIcon,
	},
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
const menuItems = computed(() => {
	return baseMenuItems.map(item => ({
		...item,
		current: isCurrentPath(item.href)
	}));
});

const menuItemsMaintainers = computed(() => {
	return baseMenuItemsMaintainers.map(item => ({
		...item,
		current: isCurrentPath(item.href)
	}));
});

const menuItemsOrgs = computed(() => {
	return baseMenuItemsOrgs.map(item => ({
		...item,
		current: isCurrentPath(item.href)
	}));
});

// Helper function to check if a path matches the current path
function isCurrentPath(itemPath: string) {
	// Special case for home page
	if (itemPath === "/" && currentPath.value === "/") {
		return true;
	}

	// For other pages, check if the current path starts with the item path
	// This handles nested routes (e.g. /blog/some-post should highlight the Blog item)
	return itemPath !== "/" && currentPath.value.startsWith(itemPath);
}
</script>

<template>
	<aside class="fixed top-0 left-0 z-40 w-64 h-screen pt-14 transition-transform -translate-x-full md:translate-x-0
		bg-gradient-to-br from-white to-gray-50 dark:from-black dark:to-gray-900
		border-r border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-100/10 dark:shadow-black/20" aria-label="Sidenav"
		id="drawer-navigation">
		<div class="overflow-y-auto py-5 px-4 h-full">
			<!-- Search for mobile -->
			<form action="/search" method="GET" class="md:hidden mb-4 relative">
				<label for="sidebar-search" class="sr-only">Search</label>
				<div class="relative">
					<div class="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
						<svg class="w-5 h-5 text-primary/70 dark:text-primary/70" fill="currentColor" viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg">
							<path fill-rule="evenodd" clip-rule="evenodd"
								d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z">
							</path>
						</svg>
					</div>
					<input type="text" name="q" id="sidebar-search" class="bg-white/80 dark:bg-black/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg
						focus:ring-2 focus:ring-primary/50 focus:border-primary/70
						block w-full pl-10 p-2.5 placeholder-gray-400 dark:placeholder-gray-500
						transition-all duration-200 ease-in-out" placeholder="Search videos..." />
				</div>
			</form>
			<ul class="space-y-1.5">
				<MenuItems :menuItems="menuItems" />
			</ul>
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
					For OSS Maintainers
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsMaintainers" />
				</ul>
			</div>
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-tertiary">
					For Organizations
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsOrgs" />
				</ul>
			</div>
		</div>
	</aside>
</template>