<script setup lang="ts">
import {
	AcademicCapIcon,
	InformationCircleIcon,
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
	ChatBubbleLeftRightIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import NavItem from "./NavItem.vue";
import type { NavItemData } from "./NavItem.vue";

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
	if (
		savedMode === "learn" ||
		savedMode === "connect" ||
		savedMode === "collaborate"
	) {
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

// Learn mode navigation items - grouped with separators
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

// Connect mode navigation items
const connectNavItems = computed(() => [
	{
		name: "Community Day",
		href: "/community-day",
		icon: CalendarIcon,
		current: isCurrentPath("/community-day"),
	},
	{
		name: "Discord",
		href: "https://rawkode.chat",
		icon: ChatBubbleLeftRightIcon,
		current: false,
		external: true,
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
		name: "Branding",
		href: "/organizations/branding",
		icon: InformationCircleIcon,
		current: isCurrentPath("/organizations/branding"),
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
	// Cycle through modes: learn -> collaborate -> connect -> learn
	if (mode.value === "learn") {
		mode.value = "collaborate";
	} else if (mode.value === "collaborate") {
		mode.value = "connect";
	} else {
		mode.value = "learn";
	}
	localStorage.setItem("sidebar-mode", mode.value);
};

const expandSidebar = () => {
	isCollapsed.value = false;
	localStorage.setItem("sidebar-collapsed", "false");
};

const currentNavItems = computed(() => {
	if (mode.value === "learn") return learnNavItems.value;
	if (mode.value === "connect") return connectNavItems.value;
	return collaborateNavItems.value;
});

// Note: Learn is rendered as a simple single-column list for clarity
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
			<!-- Mode Toggle (Expanded) - segmented control -->
			<div
				v-if="!isCollapsed"
				class="px-3 py-3 border-b border-subtle"
			>
				<div class="inline-flex w-full rounded-xl border border-white/20 dark:border-gray-600/30 bg-white/40 dark:bg-gray-800/50 backdrop-blur-md overflow-hidden shadow-sm">
					<button
						@click="mode = 'learn'; localStorage.setItem('sidebar-mode', 'learn')"
						:aria-pressed="mode === 'learn'"
						aria-label="Learn mode"
						title="Learn mode"
						:class="[
							'flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-all duration-200 whitespace-nowrap',
							mode === 'learn'
								? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
								: 'text-muted hover:text-primary hover:bg-white/50 dark:hover:bg-gray-700/50'
						]"
					>
						<BookOpenIcon class="w-4 h-4" />
						<span class="text-[0.65rem] font-semibold tracking-wide uppercase">Learn</span>
					</button>
					<button
						@click="mode = 'collaborate'; localStorage.setItem('sidebar-mode', 'collaborate')"
						:aria-pressed="mode === 'collaborate'"
						aria-label="Partner mode"
						title="Partner mode"
						:class="[
							'flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-all duration-200 border-l border-white/20 dark:border-gray-600/30 whitespace-nowrap',
							mode === 'collaborate'
								? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
								: 'text-muted hover:text-primary hover:bg-white/50 dark:hover:bg-gray-700/50'
						]"
					>
						<BuildingOfficeIcon class="w-4 h-4" />
						<span class="text-[0.65rem] font-semibold tracking-wide uppercase">Partner</span>
					</button>
					<button
						@click="mode = 'connect'; localStorage.setItem('sidebar-mode', 'connect')"
						:aria-pressed="mode === 'connect'"
						aria-label="Connect mode"
						title="Connect mode"
						:class="[
							'flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-all duration-200 border-l border-white/20 dark:border-gray-600/30 whitespace-nowrap',
							mode === 'connect'
								? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
								: 'text-muted hover:text-primary hover:bg-white/50 dark:hover:bg-gray-700/50'
						]"
					>
						<UsersIcon class="w-4 h-4" />
						<span class="text-[0.65rem] font-semibold tracking-wide uppercase">Connect</span>
					</button>
				</div>
			</div>

			<!-- Mode Toggle (Collapsed) -->
			<div
				v-else
				class="p-2 border-b border-subtle group relative"
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
			<nav class="flex-1 overflow-y-auto py-4 px-3 scroll-fade">
				<ul :class="['space-y-1', isCollapsed ? 'space-y-0.5 pr-1' : '']">
					<template v-for="(item, index) in currentNavItems" :key="'href' in item ? item.href : `sep-${index}`">
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

			<!-- Footer links removed from sidebar; available in site footer -->
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
