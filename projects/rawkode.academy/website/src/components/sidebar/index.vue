<script setup lang="ts">
import { initFlowbite } from 'flowbite';
import { onMounted } from 'vue';
import MenuItems from "./items.vue";
import {
	HomeIcon,
	InformationCircleIcon,
	NewspaperIcon,
	// QuestionMarkCircleIcon,
	RocketLaunchIcon,
	VideoCameraIcon,
} from "@heroicons/vue/24/outline";
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/20/solid';

const menuItems = [
	{ name: "Home", href: "/", icon: HomeIcon, current: true },
	// {
	// 	name: "Live",
	// 	href: "/live",
	// 	icon: FilmIcon,
	// 	current: false,
	// },
	{ name: "Blog", href: "/blog", icon: NewspaperIcon, current: false },
	// { name: 'Events', href: '/events', icon: CalendarDaysIcon, current: false },
	// { name: 'Courses', href: '#', icon: AcademicCapIcon, current: false },
	// { name: 'Shows', href: '#', icon: FilmIcon, current: false },
	{
		name: "Watch",
		href: "/watch",
		icon: VideoCameraIcon,
		current: false,
	},
	{
		name: "Join the Zulip",
		href: "https://chat.rawkode.academy",
		icon: ChatBubbleLeftEllipsisIcon,
		current: false,
		target: "_blank",
	},
	{
		name: "About",
		href: "/about",
		icon: InformationCircleIcon,
		current: false,
	},
	// { name: 'Help', href: '/help', icon: QuestionMarkCircleIcon, current: false },
];

const menuItemsMaintainers = [
	{
		name: "Share Your Project",
		href: "/maintainers/share-your-project",
		icon: RocketLaunchIcon,
		current: false,
	},
];

const menuItemsOrgs = [
	{
		name: "Partnerships",
		href: "/organizations/partnerships",
		icon: RocketLaunchIcon,
		current: false,
	},
];

onMounted(() => {
	initFlowbite();
})
</script>

<template>
	<aside
		class="fixed top-0 left-0 z-40 w-64 h-screen pt-14 transition-transform -translate-x-full bg-white border-r border-gray-200 md:translate-x-0 dark:bg-black dark:border-gray-700"
		aria-label="Sidenav" id="drawer-navigation">
		<div class="overflow-y-auto py-5 px-3 h-full">
			<!-- Search for mobile -->
			<form action="/search" method="GET" class="md:hidden mb-2">
				<label for="sidebar-search" class="sr-only">Search</label>
				<div class="relative">
					<div
						class="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none"
					>
						<svg
							class="w-5 h-5 text-gray-500 dark:text-gray-400"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fill-rule="evenodd"
								clip-rule="evenodd"
								d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
							>
							</path>
						</svg>
					</div>
					<input
						type="text"
						name="q"
						id="sidebar-search"
						class="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-1 focus:ring-primary focus:border-primary block w-full pl-10 p-2 placeholder-gray-400 dark:placeholder-gray-500"
						placeholder="Search videos..."
					/>
				</div>
			</form>
			<ul class="space-y-2">
				<MenuItems :menuItems="menuItems" />
			</ul>
			<ul class="pt-3 mt-3 space-y-2">
				<li>
					<div class="text-xs font-semibold leading-6 text-primary">
						For OSS Maintainers
					</div>
				</li>
				<MenuItems :menuItems="menuItemsMaintainers" />
			</ul>
			<ul class="pt-3 mt-3 space-y-2">
				<li>
					<div class="text-xs font-semibold leading-6 text-primary">
						For Organizations
					</div>
				</li>
				<MenuItems :menuItems="menuItemsOrgs" />
			</ul>
		</div>
	</aside>
</template>
