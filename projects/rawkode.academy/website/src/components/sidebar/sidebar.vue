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
		name: "Shows",
		href: "/shows",
		icon: TvIcon,
		current: isCurrentPath("/shows"),
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
		children: [
			{
				name: "Radar",
				href: "/technology/radar",
				current: isCurrentPath("/technology/radar"),
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

// Note: Learn is rendered as a simple single-column list for clarity
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
			<!-- Mode Toggle (Expanded) - segmented control -->
			<div
				v-if="!isCollapsed"
				class="px-3 py-3 border-b border-white/20 dark:border-gray-700/40"
			>
				<div class="inline-flex w-full rounded-xl border border-white/30 dark:border-gray-600/40 bg-white/50 dark:bg-gray-700/40 backdrop-blur-md overflow-hidden">
					<button
						@click="mode = 'learn'; localStorage.setItem('sidebar-mode', 'learn')"
						:aria-pressed="mode === 'learn'"
						:aria-label="'Learn mode'"
						:title="'Learn mode'"
						:class="[
							'flex-1 inline-flex md:flex-row flex-col items-center md:justify-center justify-start gap-1.5 px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap',
							mode === 'learn' ? 'bg-white dark:bg-gray-600 text-primary shadow-inner' : 'text-gray-600 dark:text-gray-200 hover:text-primary'
						]"
					>
						<BookOpenIcon class="w-4 h-4" />
						<span class="mt-1 md:mt-0 md:ml-0 text-xs md:hidden">Learn</span>
					</button>
					<button
						@click="mode = 'connect'; localStorage.setItem('sidebar-mode', 'connect')"
						:aria-pressed="mode === 'connect'"
						:aria-label="'Connect mode'"
						:title="'Connect mode'"
						:class="[
							'flex-1 inline-flex md:flex-row flex-col items-center md:justify-center justify-start gap-1.5 px-2 py-2 text-xs font-medium transition-colors border-l border-white/30 dark:border-gray-600/40 whitespace-nowrap',
							mode === 'connect' ? 'bg-white dark:bg-gray-600 text-primary shadow-inner' : 'text-gray-600 dark:text-gray-200 hover:text-primary'
						]"
					>
						<UsersIcon class="w-4 h-4" />
						<span class="mt-1 md:mt-0 md:ml-0 text-xs md:hidden">Connect</span>
					</button>
					<button
						@click="mode = 'collaborate'; localStorage.setItem('sidebar-mode', 'collaborate')"
						:aria-pressed="mode === 'collaborate'"
						:aria-label="'Partner mode'"
						:title="'Partner mode'"
						:class="[
							'flex-1 inline-flex md:flex-row flex-col items-center md:justify-center justify-start gap-1.5 px-2 py-2 text-xs font-medium transition-colors border-l border-white/30 dark:border-gray-600/40 whitespace-nowrap',
							mode === 'collaborate' ? 'bg-white dark:bg-gray-600 text-primary shadow-inner' : 'text-gray-600 dark:text-gray-200 hover:text-primary'
						]"
					>
						<BuildingOfficeIcon class="w-4 h-4" />
						<span class="mt-1 md:mt-0 md:ml-0 text-xs md:hidden">Partner</span>
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
			<nav class="flex-1 overflow-y-auto py-6 px-3 scroll-fade">
				<!-- Mode Header removed for a cleaner, denser layout -->

				<!-- Main Navigation - single column for all modes -->
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
							<!-- Submenu items - only show when on parent route -->
							<ul
								v-if="item.children && item.children.length > 0 && !isCollapsed && item.current"
								class="mt-2 mb-2 ml-2 mr-1 p-1.5 space-y-0.5 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-sm relative overflow-hidden"
							>
								<!-- Decorative shine -->
								<div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-50"></div>

								<li v-for="child in item.children" :key="child.href" class="relative z-10">
									<a
										:href="child.href"
										:class="[
											'flex items-center text-xs font-medium rounded-lg px-3 py-2 transition-all duration-200',
											child.current
												? 'bg-white dark:bg-white/10 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10 font-semibold'
												: 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-primary',
										]"
										:aria-current="child.current ? 'page' : undefined"
									>
										{{ child.name }}
									</a>
								</li>
							</ul>
						</li>
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

/* Subtle fade at top/bottom to hint scrollability */
.scroll-fade {
	-webkit-mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
	mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
}
</style>
