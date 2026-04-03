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
	{
		name: "News",
		href: "/news",
		icon: MegaphoneIcon,
	},
	{
		name: "Videos",
		href: "/watch",
		icon: VideoCameraIcon,
	},
	{
		name: "Articles",
		href: "/read",
		icon: NewspaperIcon,
	},
	{
		name: "Learning Paths",
		href: "/learning-paths",
		icon: MapIcon,
	},
	{
		name: "Courses",
		href: "/courses",
		icon: AcademicCapIcon,
	},
	{
		name: "Shows",
		href: "/shows",
		icon: TvIcon,
	},
	{
		name: "People",
		href: "/people",
		icon: UsersIcon,
	},
	{
		name: "Technologies",
		href: "/technology",
		icon: CubeIcon,
		children: [
			{
				name: "Matrix",
				href: "/technology/matrix",
				children: [
					{
						name: "Advanced",
						href: "/technology/matrix/advanced",
					},
				],
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
	if (itemPath === "/" && currentPath.value === "/") {
		return true;
	}
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
		class="glass-panel sidebar-shell"
		:class="[
			'fixed top-28 left-4 md:left-8 bottom-4 z-30 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
			'rounded-[2rem]',
			isCollapsed ? 'hidden md:block md:w-[4.75rem]' : 'block w-64',
		]"
		aria-label="Sidebar navigation"
	>
		<div class="relative z-10 flex h-full flex-col">
			<nav class="sidebar-scroll flex-1 overflow-y-auto px-3 py-3">
				<div v-if="isCollapsed" class="sidebar-rail-mark mb-3" aria-hidden="true">
					<span class="sidebar-rail-bar sidebar-rail-bar-strong"></span>
				</div>

				<ul :class="isCollapsed ? 'space-y-2' : 'space-y-1.5'">
					<li v-for="item in navItems" :key="item.href">
						<NavItem
							:item="item"
							:isCollapsed="isCollapsed"
							@expand="expandSidebar"
						/>
					</li>
				</ul>
			</nav>
		</div>
	</aside>

	<div
		v-show="!isCollapsed"
		class="fixed inset-0 z-20 bg-[rgb(15_23_42_/_0.18)] backdrop-blur-[2px] md:hidden"
		@click="toggleCollapse"
		aria-label="Close sidebar"
	></div>
</template>

<style scoped>
@reference "../../styles/global.css";

.sidebar-shell {
	isolation: isolate;
	overflow: hidden;
	border-color: rgb(255 255 255 / 0.58);
	background:
		radial-gradient(
			circle at top left,
			rgb(var(--brand-primary) / 0.12),
			transparent 42%
		),
		radial-gradient(
			circle at bottom right,
			rgb(var(--brand-secondary) / 0.1),
			transparent 38%
		),
		linear-gradient(
			180deg,
			rgb(255 255 255 / 0.88) 0%,
			rgb(248 250 252 / 0.78) 100%
		);
	box-shadow:
		0 24px 52px -36px rgb(15 23 42 / 0.4),
		inset 0 1px 0 rgb(255 255 255 / 0.72);
}

.sidebar-shell::before,
.sidebar-shell::after {
	content: "";
	position: absolute;
	pointer-events: none;
	inset: 0;
}

.sidebar-shell::before {
	background: linear-gradient(
		180deg,
		rgb(255 255 255 / 0.42) 0%,
		transparent 22%,
		transparent 78%,
		rgb(15 23 42 / 0.04) 100%
	);
	opacity: 0.78;
}

.sidebar-shell::after {
	inset: 12px;
	border-radius: 1.55rem;
	border: 1px solid rgb(255 255 255 / 0.35);
	opacity: 0.7;
}

html.dark .sidebar-shell {
	border-color: rgb(148 163 184 / 0.16);
	background:
		radial-gradient(
			circle at top left,
			rgb(var(--brand-primary) / 0.16),
			transparent 38%
		),
		radial-gradient(
			circle at bottom right,
			rgb(var(--brand-secondary) / 0.1),
			transparent 38%
		),
		linear-gradient(
			180deg,
			rgb(6 11 24 / 0.92) 0%,
			rgb(10 15 29 / 0.88) 100%
		);
	box-shadow:
		0 28px 64px -38px rgb(2 6 23 / 0.88),
		inset 0 1px 0 rgb(255 255 255 / 0.04);
}

html.dark .sidebar-shell::before {
	background: linear-gradient(
		180deg,
		rgb(255 255 255 / 0.05) 0%,
		transparent 22%,
		transparent 82%,
		rgb(255 255 255 / 0.02) 100%
	);
	opacity: 0.8;
}

html.dark .sidebar-shell::after {
	border-color: rgb(255 255 255 / 0.06);
}

.sidebar-rail-mark {
	display: grid;
	justify-items: center;
	gap: 0.45rem;
}

.sidebar-rail-bar {
	width: 2rem;
	height: 0.14rem;
	border-radius: 999px;
	background: rgb(var(--brand-primary) / 0.24);
}

.sidebar-rail-bar-strong {
	width: 2.5rem;
	background: linear-gradient(
		90deg,
		rgb(var(--brand-primary)) 0%,
		rgb(var(--brand-secondary)) 100%
	);
}

.sidebar-scroll {
	-webkit-mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
	mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
	scrollbar-width: thin;
	scrollbar-color: rgb(var(--brand-primary) / 0.35) transparent;
}

.sidebar-scroll::-webkit-scrollbar {
	width: 6px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
	border-radius: 999px;
	background: rgb(var(--brand-primary) / 0.28);
}
</style>
