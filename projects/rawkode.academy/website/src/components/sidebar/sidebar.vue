<script setup lang="ts">
import {
	AcademicCapIcon,
	CalendarIcon,
	ChatBubbleLeftEllipsisIcon,
	ChevronDownIcon,
	CubeIcon,
	MapIcon,
	NewspaperIcon,
	RocketLaunchIcon,
	TvIcon,
	VideoCameraIcon,
	WrenchScrewdriverIcon,
	BuildingOfficeIcon,
	BookOpenIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";

// Get the current path from the window location
const currentPath = ref("");
const isCollapsed = ref(false);
const communityExpanded = ref(false);

// Mode: 'learn' or 'business'
const mode = ref<'learn' | 'business'>('learn');

onMounted(() => {
	currentPath.value = window.location.pathname;

	// Auto-detect mode based on current path
	if (currentPath.value.startsWith("/organizations")) {
		mode.value = 'business';
	}

	// Auto-expand community if on community page
	if (currentPath.value.startsWith("/community-day")) {
		communityExpanded.value = true;
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
	if (savedMode === 'business' || savedMode === 'learn') {
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
	{ name: "Videos", href: "/watch", icon: VideoCameraIcon, current: isCurrentPath("/watch") },
	{ name: "Articles", href: "/read", icon: NewspaperIcon, current: isCurrentPath("/read") },
	{ name: "Courses", href: "/courses", icon: AcademicCapIcon, current: isCurrentPath("/courses") },
	{ name: "Learning Paths", href: "/learning-paths", icon: MapIcon, current: isCurrentPath("/learning-paths") },
	{ name: "Technologies", href: "/technology", icon: CubeIcon, current: isCurrentPath("/technology") },
	{ name: "Shows", href: "/shows", icon: TvIcon, current: isCurrentPath("/shows") },
]);

// Business mode navigation items
const businessNavItems = computed(() => [
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

// Community items (only shown in learn mode)
const communityItems = computed(() => [
	{
		name: "Community Day",
		href: "/community-day",
		icon: CalendarIcon,
		current: isCurrentPath("/community-day"),
	},
]);

const toggleCollapse = () => {
	isCollapsed.value = !isCollapsed.value;
	localStorage.setItem("sidebar-collapsed", String(isCollapsed.value));
};

const toggleCommunity = () => {
	communityExpanded.value = !communityExpanded.value;
};

const toggleMode = () => {
	mode.value = mode.value === 'learn' ? 'business' : 'learn';
	localStorage.setItem("sidebar-mode", mode.value);
};

const currentNavItems = computed(() => {
	return mode.value === 'learn' ? learnNavItems.value : businessNavItems.value;
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
			<!-- Mode Toggle -->
			<div
				v-if="!isCollapsed"
				class="px-3 py-4 border-b border-white/20 dark:border-gray-700/40"
			>
				<div class="flex items-center gap-1 bg-white/30 dark:bg-gray-700/40 backdrop-blur-md rounded-xl p-1 border border-white/30 dark:border-gray-500/50 shadow-inner">
					<button
						@click="mode = 'learn'; localStorage.setItem('sidebar-mode', 'learn')"
						:class="[
							'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
							mode === 'learn'
								? 'bg-gradient-to-br from-white/90 to-white/70 dark:from-gray-600/95 dark:to-gray-600/80 text-primary dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md border dark:border-gray-400/50'
								: 'text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-gray-600/50',
						]"
					>
						<BookOpenIcon class="w-5 h-5 flex-shrink-0" />
						<span>Learn</span>
					</button>
					<button
						@click="mode = 'business'; localStorage.setItem('sidebar-mode', 'business')"
						:class="[
							'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
							mode === 'business'
								? 'bg-gradient-to-br from-white/90 to-white/70 dark:from-gray-600/95 dark:to-gray-600/80 text-primary dark:text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md border dark:border-gray-400/50'
								: 'text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-gray-600/50',
						]"
					>
						<BuildingOfficeIcon class="w-5 h-5 flex-shrink-0" />
						<span>Collab</span>
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
					:class="[
						'w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200',
						mode === 'learn'
							? 'text-primary bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-md shadow-lg border border-primary/30 scale-105'
							: 'text-secondary bg-gradient-to-br from-secondary/20 to-secondary/10 backdrop-blur-md shadow-lg border border-secondary/30 scale-105',
					]"
					:title="mode === 'learn' ? 'Switch to Collaborate Mode' : 'Switch to Learn Mode'"
				>
					<BookOpenIcon v-if="mode === 'learn'" class="w-6 h-6" />
					<BuildingOfficeIcon v-else class="w-6 h-6" />
				</button>

			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto py-6 px-3">
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

				<!-- Community Section (Learn Mode Only) -->
				<div v-if="mode === 'learn'" class="mt-6 pt-6 border-t border-white/20 dark:border-gray-700/30">
					<button
						v-if="!isCollapsed"
						@click="toggleCommunity"
						class="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
					>
						<span>Community</span>
						<ChevronDownIcon
							:class="[
								'w-4 h-4 transition-transform duration-200',
								communityExpanded ? 'rotate-180' : '',
							]"
						/>
					</button>

					<div
						v-if="isCollapsed"
						class="h-px bg-white/20 dark:bg-gray-700/30 mb-2"
					></div>

					<Transition
						enter-active-class="transition-all duration-200 ease-out"
						enter-from-class="transform -translate-y-2 opacity-0 max-h-0"
						enter-to-class="transform translate-y-0 opacity-100 max-h-32"
						leave-active-class="transition-all duration-150 ease-in"
						leave-from-class="transform translate-y-0 opacity-100 max-h-32"
						leave-to-class="transform -translate-y-2 opacity-0 max-h-0"
					>
						<ul
							v-show="communityExpanded || isCollapsed"
							:class="['mt-2 space-y-1', isCollapsed ? 'space-y-0.5' : '']"
						>
							<li v-for="item in communityItems" :key="item.href">
								<a
									:href="item.href"
									:target="item.target"
									:class="[
										'flex items-center text-sm font-medium rounded-xl transition-[background,scale,colors,border] duration-200',
										'group relative will-change-transform border border-transparent',
										isCollapsed
											? 'flex-col items-center justify-center text-center gap-0.5 p-2.5 text-[0.65rem]'
											: 'px-3 py-2.5',
										item.current
											? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-[0_2px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] backdrop-blur-md border-primary/30'
											: isCollapsed
												? 'text-gray-700 dark:text-gray-100 hover:text-primary dark:hover:text-primary'
												: 'text-gray-700 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-700/80 hover:text-primary hover:scale-[1.02] hover:border-white/30 dark:hover:border-gray-500/50',
									]"
									:title="isCollapsed ? item.name : undefined"
								>
									<component
										:is="item.icon"
										:class="[
											'flex-shrink-0 transition-colors',
											isCollapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3',
											item.current
												? 'text-primary'
												: 'text-gray-500 dark:text-gray-200 group-hover:text-primary',
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
					</Transition>
				</div>
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
