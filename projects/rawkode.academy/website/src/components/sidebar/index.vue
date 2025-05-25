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
	CubeIcon,
	DocumentTextIcon,
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
	{ name: "Articles", href: "/read", icon: NewspaperIcon },
	// { name: 'Events', href: '/events', icon: CalendarDaysIcon },
	// { name: 'Courses', href: '#', icon: AcademicCapIcon },
	// { name: 'Shows', href: '#', icon: FilmIcon },
	{
		name: "Videos",
		href: "/watch",
		icon: VideoCameraIcon,
	},
	{
		name: "Technologies",
		href: "/technology",
		icon: CubeIcon,
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

const baseMenuItemsContributors = [
	{
		name: "ADRs",
		href: "/adrs",
		icon: DocumentTextIcon,
	},
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

const menuItemsContributors = computed(() => {
	return baseMenuItemsContributors.map(item => ({
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
	// This handles nested routes (e.g. /read/some-post should highlight the article)
	return itemPath !== "/" && currentPath.value.startsWith(itemPath);
}
</script>

<template>
	<aside class="fixed top-0 left-0 z-40 w-64 h-screen pt-14 transition-transform -translate-x-full md:translate-x-0
		bg-linear-to-br from-white to-gray-50 dark:from-black dark:to-gray-900
		border-r border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-100/10 dark:shadow-black/20" aria-label="Sidenav"
		id="drawer-navigation">
		<div class="overflow-y-auto py-5 px-4 h-full">

			<ul class="space-y-1.5">
				<MenuItems :menuItems="menuItems" />
			</ul>
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary">
					For Contributors
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsContributors" />
				</ul>
			</div>
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary">
					For OSS Maintainers
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsMaintainers" />
				</ul>
			</div>
			<div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
				<div
					class="text-xs font-semibold leading-6 px-2 mb-2 bg-clip-text text-transparent bg-linear-to-r from-primary to-tertiary">
					For Organizations
				</div>
				<ul class="space-y-1.5">
					<MenuItems :menuItems="menuItemsOrgs" />
				</ul>
			</div>
		</div>
	</aside>
</template>

