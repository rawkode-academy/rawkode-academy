<script setup lang="ts">
import {
	AcademicCapIcon,
	CalendarIcon,
	ChatBubbleLeftEllipsisIcon,
	CubeIcon,
	MapIcon,
	NewspaperIcon,
	RocketLaunchIcon,
	TvIcon,
	VideoCameraIcon,
	WrenchScrewdriverIcon,
	BuildingOfficeIcon,
	BookOpenIcon,
	UsersIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";

// Get the current path from the window location
const currentPath = ref("");
const isCollapsed = ref(false);

// Mode: 'learn', 'connect', or 'collaborate'
const mode = ref<"learn" | "connect" | "collaborate">("learn");

onMounted(() => {
	currentPath.value = window.location.pathname;

	// Auto-detect mode based on current path
	if (currentPath.value.startsWith("/organizations")) {
		mode.value = "collaborate";
	} else if (currentPath.value.startsWith("/community-day")) {
		mode.value = "connect";
	}

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

	const savedMode = localStorage.getItem("sidebar-mode");
	if (savedMode === "learn" || savedMode === "connect" || savedMode === "collaborate") {
		mode.value = savedMode;
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

// Learn mode navigation items
const learnNavItems = computed(() => [
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
	{
		name: "Courses",
		href: "/courses",
		icon: AcademicCapIcon,
		current: isCurrentPath("/courses"),
	},
	{
		name: "Learning Paths",
		href: "/learning-paths",
		icon: MapIcon,
		current: isCurrentPath("/learning-paths"),
	},
	{
		name: "Technologies",
		href: "/technology",
		icon: CubeIcon,
		current: isCurrentPath("/technology"),
	},
	{
		name: "Shows",
		href: "/shows",
		icon: TvIcon,
		current: isCurrentPath("/shows"),
	},
]);

// Connect mode navigation items
const connectNavItems = computed(() => [
	{
		name: "Community Day",
		href: "/community-day",
		icon: CalendarIcon,
		current: isCurrentPath("/community-day"),
	},
]);

// Collaborate mode navigation items
const collaborateNavItems = computed(() => [
	{
		name: "Partnerships",
		href: "/organizations/partnerships",
		icon: RocketLaunchIcon,
		current: isCurrentPath("/organizations/partnerships"),
	},
	{
		name: "Consulting",
		href: "/organizations/consulting",
		icon: WrenchScrewdriverIcon,
		current: isCurrentPath("/organizations/consulting"),
	},
	{
		name: "Training",
		href: "/organizations/training",
		icon: AcademicCapIcon,
		current: isCurrentPath("/organizations/training"),
	},
	{
		name: "Let's Chat",
		href: "/organizations/lets-chat",
		icon: ChatBubbleLeftEllipsisIcon,
		current: isCurrentPath("/organizations/lets-chat"),
	},
]);

const toggleCollapse = () => {
	isCollapsed.value = !isCollapsed.value;
	localStorage.setItem("sidebar-collapsed", String(isCollapsed.value));
};

const toggleMode = () => {
	// Cycle through modes: learn -> connect -> collaborate -> learn
	if (mode.value === "learn") {
		mode.value = "connect";
	} else if (mode.value === "connect") {
		mode.value = "collaborate";
	} else {
		mode.value = "learn";
	}
	localStorage.setItem("sidebar-mode", mode.value);
};

const currentNavItems = computed(() => {
	if (mode.value === "learn") return learnNavItems.value;
	if (mode.value === "connect") return connectNavItems.value;
	return collaborateNavItems.value;
});
</script>

<template>
	<aside
		class="sidebar-glassmorphism"
		:class="[
			'fixed top-28 left-4 md:left-8 bottom-4 z-30 transition-all duration-300 ease-in-out',
			'rounded-2xl',
			// Desktop: always visible, toggles between collapsed/expanded
			// Mobile: hidden by default (collapsed), shows when expanded (!isCollapsed)
			isCollapsed ? 'hidden md:block md:w-[4.5rem]' : 'block w-64',
		]"
		aria-label="Sidebar navigation"
	>
		<div class="flex flex-col h-full">
			<!-- Mode Toggle (Expanded) -->
			<div
				v-if="!isCollapsed"
				class="px-3 py-4 border-b border-white/20 dark:border-gray-700/40"
			>
				<div class="flex flex-col gap-2">
					<button
						@click="mode = 'learn'; localStorage.setItem('sidebar-mode', 'learn')"
						:class="[
							'flex items-start gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200',
							mode === 'learn'
								? 'bg-gradient-to-br from-white/90 to-white/70 dark:from-gray-600/95 dark:to-gray-600/80 text-primary dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md border dark:border-gray-400/50'
								: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60 border border-transparent',
						]"
					>
						<BookOpenIcon class="w-5 h-5 flex-shrink-0 mt-0.5" />
						<div class="flex-1 text-left">
							<div class="font-semibold">Learn</div>
							<div class="text-xs opacity-80 mt-0.5">Browse educational content</div>
						</div>
					</button>
					<button
						@click="mode = 'connect'; localStorage.setItem('sidebar-mode', 'connect')"
						:class="[
							'flex items-start gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200',
							mode === 'connect'
								? 'bg-gradient-to-br from-white/90 to-white/70 dark:from-gray-600/95 dark:to-gray-600/80 text-primary dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md border dark:border-gray-400/50'
								: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60 border border-transparent',
						]"
					>
						<UsersIcon class="w-5 h-5 flex-shrink-0 mt-0.5" />
						<div class="flex-1 text-left">
							<div class="font-semibold">Connect</div>
							<div class="text-xs opacity-80 mt-0.5">Join our community</div>
						</div>
					</button>
					<button
						@click="mode = 'collaborate'; localStorage.setItem('sidebar-mode', 'collaborate')"
						:class="[
							'flex items-start gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200',
							mode === 'collaborate'
								? 'bg-gradient-to-br from-white/90 to-white/70 dark:from-gray-600/95 dark:to-gray-600/80 text-primary dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md border dark:border-gray-400/50'
								: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60 border border-transparent',
						]"
					>
						<BuildingOfficeIcon class="w-5 h-5 flex-shrink-0 mt-0.5" />
						<div class="flex-1 text-left">
							<div class="font-semibold">Collaborate</div>
							<div class="text-xs opacity-80 mt-0.5">Work with us</div>
						</div>
					</button>
				</div>
			</div>

			<!-- Mode Toggle (Collapsed) -->
			<div
				v-else
				class="p-2 border-b border-white/20 dark:border-gray-700/40 group relative"
			>
				<button
					@click="toggleMode"
					class="w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200 text-primary bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-md shadow-lg border border-primary/30 scale-105 hover:scale-110"
					:title="mode === 'learn' ? 'Learn Mode (Click to switch)' : mode === 'connect' ? 'Connect Mode (Click to switch)' : 'Collaborate Mode (Click to switch)'"
				>
					<BookOpenIcon v-if="mode === 'learn'" class="w-6 h-6" />
					<UsersIcon v-else-if="mode === 'connect'" class="w-6 h-6" />
					<BuildingOfficeIcon v-else class="w-6 h-6" />
				</button>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto py-6 px-3">
				<!-- Mode Header -->
				<div v-if="!isCollapsed" class="mb-4 px-3">
					<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
						{{ mode === 'learn' ? 'Learning Resources' : mode === 'connect' ? 'Get Involved' : 'Partner With Us' }}
					</h2>
				</div>

				<!-- Main Navigation -->
				<ul :class="['space-y-1', isCollapsed ? 'space-y-0.5 pr-1' : '']">
					<li v-for="item in currentNavItems" :key="item.href">
						<a
							:href="item.href"
							:class="[
								'flex items-center text-sm font-medium rounded-xl transition-[background,scale,colors,border] duration-200',
								'group relative will-change-transform border border-transparent w-full',
								isCollapsed
									? 'flex-col items-center justify-center text-center gap-0.5 p-2 text-[0.65rem]'
									: 'px-3 py-2.5',
								item.current
									? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-[0_2px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] backdrop-blur-md border-primary/30'
									: isCollapsed
										? 'text-gray-700 dark:text-gray-100 hover:text-primary dark:hover:text-primary'
										: 'text-gray-700 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-700/80 hover:text-primary hover:scale-[1.02] hover:border-white/30 dark:hover:border-gray-500/50',
							]"
							:aria-current="item.current ? 'page' : undefined"
							:title="isCollapsed ? item.name : undefined"
						>
							<component
								:is="item.icon"
								:class="[
									'flex-shrink-0 transition-colors',
									isCollapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3',
									item.current ? 'text-primary' : 'text-gray-500 dark:text-gray-200 group-hover:text-primary',
								]"
							/>
							<span
								:class="[
									'transition-opacity duration-200',
									isCollapsed
										? 'block leading-[1.05] text-center text-[0.6rem] tracking-tight max-w-[3.5rem]'
										: '',
								]"
							>
								{{ item.name }}
							</span>
							</a>
					</li>
				</ul>
			</nav>

			<!-- Footer Links -->
			<div
				v-if="!isCollapsed"
				class="border-t border-white/20 dark:border-gray-700/40 px-3 py-4"
			>
				<div class="space-y-1">
					<a
						href="/about"
						class="block px-3 py-2 text-sm text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white rounded-xl border border-transparent hover:bg-white/80 dark:hover:bg-gray-700/80 hover:scale-[1.02] hover:border-white/30 dark:hover:border-gray-500/50 transition-[background,scale,colors,border] duration-200 will-change-transform"
					>
						About
					</a>
					<a
						href="/changelog"
						class="block px-3 py-2 text-sm text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white rounded-xl border border-transparent hover:bg-white/80 dark:hover:bg-gray-700/80 hover:scale-[1.02] hover:border-white/30 dark:hover:border-gray-500/50 transition-[background,scale,colors,border] duration-200 will-change-transform"
					>
						Changelog
					</a>
				</div>
			</div>
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
.sidebar-glassmorphism {
	background: var(--surface-card);
	backdrop-filter: blur(32px) saturate(170%);
	-webkit-backdrop-filter: blur(32px) saturate(170%);
	border: 1px solid var(--surface-border);
	box-shadow: var(--surface-shadow);
}

.sidebar-glassmorphism::before {
	content: '';
	position: absolute;
	inset: 0;
	background: linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.08) 60%, transparent);
	border-radius: inherit;
	pointer-events: none;
	z-index: 1;
}

.sidebar-glassmorphism::after {
	content: '';
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.1) 100%);
	border-radius: inherit;
	pointer-events: none;
	z-index: 1;
}

.sidebar-glassmorphism > * {
	position: relative;
	z-index: 2;
}
</style>
