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
import { css, cx } from "styled-system/css";

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

const asideBaseStyles = css({
	position: 'fixed',
	top: '28',
	left: '4',
	bottom: '4',
	zIndex: '30',
	transition: 'all',
	transitionDuration: '300ms',
	transitionTimingFunction: 'ease-in-out',
	borderRadius: '2xl',
	md: { left: '8' },
});

const overlayStyles = css({
	position: 'absolute',
	inset: '0',
	backgroundImage: {
		base: 'linear-gradient(to bottom right, rgba(255,255,255,0.6), rgba(4,181,156,0.1), transparent)',
		_dark: 'linear-gradient(to bottom right, rgba(17,24,39,0.6), rgba(4,181,156,0.2), transparent)',
	},
	opacity: '0.7',
	pointerEvents: 'none',
	borderRadius: '2xl',
});

const innerWrapperStyles = css({
	display: 'flex',
	flexDir: 'column',
	h: 'full',
	position: 'relative',
	zIndex: '10',
});

const navStyles = css({
	flex: '1',
	overflowY: 'auto',
	py: '4',
	px: '3',
});

const separatorStyles = css({
	borderTopWidth: '1px',
	borderColor: { base: 'rgba(229,231,235,0.5)', _dark: 'rgba(55,65,81,0.5)' },
	mx: '2',
});

const mobileOverlayStyles = css({
	position: 'fixed',
	inset: '0',
	bg: 'rgba(0,0,0,0.3)',
	backdropFilter: 'blur(4px)',
	zIndex: '20',
	display: { md: 'none' },
});

// Pre-computed styles for template conditionals (avoid css() calls inside render)
const asideCollapsed = css({ display: { base: 'none', md: 'block' }, w: { md: '18' } });
const asideExpanded = css({ display: 'block', w: '64' });
const listSpacing = css({ spaceY: '1' });
const listSpacingCollapsed = css({ spaceY: '0.5', pr: '1' });
const separatorPyCollapsed = css({ py: '1' });
const separatorPyExpanded = css({ py: '2' });
</script>

<template>
	<aside
		:class="[
			'glass-panel',
			asideBaseStyles,
			isCollapsed ? asideCollapsed : asideExpanded,
		]"
		aria-label="Sidebar navigation"
	>
		<div :class="overlayStyles" />
		<div :class="innerWrapperStyles">
			<!-- Navigation -->
			<nav :class="[navStyles, 'scroll-fade']">
				<ul :class="[
					listSpacing,
					isCollapsed ? listSpacingCollapsed : '',
				]">
					<template v-for="(item, index) in navItems" :key="'href' in item ? item.href : `sep-${index}`">
						<!-- Separator -->
						<li v-if="item.separator" :class="isCollapsed ? separatorPyCollapsed : separatorPyExpanded">
							<div :class="separatorStyles"></div>
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
		:class="mobileOverlayStyles"
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
