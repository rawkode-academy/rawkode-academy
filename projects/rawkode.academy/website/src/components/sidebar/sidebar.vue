<script setup lang="ts">
import {
	AcademicCapIcon,
	CubeIcon,
	MapIcon,
	MegaphoneIcon,
	NewspaperIcon,
	TvIcon,
	VideoCameraIcon,
	UsersIcon,
} from "@heroicons/vue/24/outline";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import NavItem from "./NavItem.vue";
import type { NavItemData } from "./NavItem.vue";

interface RawNavItem extends Omit<NavItemData, "current" | "children"> {
	children?: RawNavItem[];
}

const currentPath = ref("");
const isCollapsed = ref(false);
const isMobileViewport = ref(false);
const storageKey = "sidebar-collapsed";

const baseItems: RawNavItem[] = [
	{ name: "News", href: "/news", icon: MegaphoneIcon },
	{ name: "Videos", href: "/watch", icon: VideoCameraIcon },
	{ name: "Articles", href: "/read", icon: NewspaperIcon },
	{ name: "Learning Paths", href: "/learning-paths", icon: MapIcon },
	{ name: "Courses", href: "/courses", icon: AcademicCapIcon },
	{ name: "Shows", href: "/shows", icon: TvIcon },
	{ name: "People", href: "/people", icon: UsersIcon },
	{
		name: "Technologies",
		href: "/technology",
		icon: CubeIcon,
		children: [
			{
				name: "Matrix",
				href: "/technology/matrix",
				children: [{ name: "Advanced", href: "/technology/matrix/advanced" }],
			},
		],
	},
];

onMounted(() => {
	currentPath.value = window.location.pathname;
	syncViewportState();

	if (!isMobileViewport.value) {
		isCollapsed.value = localStorage.getItem(storageKey) === "true";
	}

	window.addEventListener("toggle-sidebar", handleSidebarToggle);
	window.addEventListener("resize", syncViewportState, { passive: true });
});

onBeforeUnmount(() => {
	window.removeEventListener("toggle-sidebar", handleSidebarToggle);
	window.removeEventListener("resize", syncViewportState);
});

function isCurrentPath(itemPath: string) {
	if (itemPath === "/" && currentPath.value === "/") return true;
	return itemPath !== "/" && currentPath.value.startsWith(itemPath);
}

function hydrateNavItem(item: RawNavItem): NavItemData {
	return {
		...item,
		current: isCurrentPath(item.href),
		children: item.children?.map(hydrateNavItem),
	};
}

const navItems = computed<NavItemData[]>(() => baseItems.map(hydrateNavItem));

function syncViewportState() {
	const nextIsMobile = window.innerWidth < 768;
	const viewportChanged = nextIsMobile !== isMobileViewport.value;

	isMobileViewport.value = nextIsMobile;

	if (nextIsMobile) {
		isCollapsed.value = true;
		return;
	}

	if (viewportChanged) {
		isCollapsed.value = localStorage.getItem(storageKey) === "true";
	}
}

function persistCollapseState() {
	if (!isMobileViewport.value) {
		localStorage.setItem(storageKey, String(isCollapsed.value));
	}
}

function handleSidebarToggle() {
	isCollapsed.value = !isCollapsed.value;
	persistCollapseState();
}

const toggleCollapse = () => {
	isCollapsed.value = !isCollapsed.value;
	persistCollapseState();
};

const expandSidebar = () => {
	isCollapsed.value = false;
	persistCollapseState();
};
</script>

<template>
	<aside
		class="ed-sidebar"
		:class="[
			isCollapsed ? 'ed-sidebar--collapsed hidden md:block' : 'ed-sidebar--expanded',
		]"
		aria-label="Sidebar navigation"
	>
		<div class="ed-sidebar__index" aria-hidden="true">
			<span class="ed-sidebar__index-mark">§</span>
			<span v-if="!isCollapsed" class="ed-sidebar__index-label">Index</span>
		</div>

		<nav class="ed-sidebar__nav">
			<ul class="ed-sidebar__list">
				<li v-for="item in navItems" :key="item.href" class="ed-sidebar__item">
					<NavItem
						:item="item"
						:isCollapsed="isCollapsed"
						@expand="expandSidebar"
					/>
				</li>
			</ul>
		</nav>
	</aside>

	<div
		v-show="!isCollapsed && isMobileViewport"
		class="ed-sidebar__scrim md:hidden"
		@click="toggleCollapse"
		aria-label="Close sidebar"
	></div>
</template>

<style scoped>
.ed-sidebar {
	position: fixed;
	top: 64px; /* matches ed-topbar height */
	left: 0;
	bottom: 0;
	z-index: 30;
	background: var(--editorial-paper);
	border-right: 1px solid var(--editorial-hairline);
	display: flex;
	flex-direction: column;
	transition: width var(--duration-slow) var(--ease-standard);
	overflow: hidden;
}

.ed-sidebar--expanded { width: 18rem; }
.ed-sidebar--collapsed { width: 3.5rem; }

@media (max-width: 767px) {
	.ed-sidebar--expanded {
		width: min(20rem, 88vw);
		box-shadow: 0 0 0 1px var(--editorial-hairline);
	}
	/* On mobile the collapsed sidebar must hide entirely — the user
	   reaches the nav via the hamburger button. The `hidden` utility
	   alone can't win against the scoped `.ed-sidebar { display: flex }`
	   selector, so explicitly override here. */
	.ed-sidebar--collapsed {
		display: none;
	}
}

.ed-sidebar__index {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.875rem 1rem;
	border-bottom: 1px solid var(--editorial-hairline);
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.6875rem;
	font-weight: 500;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute);
	min-height: 44px;
}

.ed-sidebar--collapsed .ed-sidebar__index {
	justify-content: center;
	padding: 0.875rem 0;
}

.ed-sidebar__index-mark {
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-size: 1rem;
	color: var(--editorial-ink);
	line-height: 1;
}

.ed-sidebar__nav {
	flex: 1;
	overflow-y: auto;
	padding: 0.5rem 0;
	scrollbar-width: thin;
	scrollbar-color: var(--editorial-hairline-strong) transparent;
}

.ed-sidebar__nav::-webkit-scrollbar { width: 4px; }
.ed-sidebar__nav::-webkit-scrollbar-thumb {
	background: var(--editorial-hairline-strong);
}

.ed-sidebar__list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.ed-sidebar__item {
	margin: 0;
}

.ed-sidebar__scrim {
	position: fixed;
	inset: 0;
	z-index: 20;
	background: oklch(0.18 0.02 60 / 0.45);
}

html.dark .ed-sidebar {
	background: var(--surface-base);
}
</style>
