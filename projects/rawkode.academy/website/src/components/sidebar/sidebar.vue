<script setup lang="ts">
import {
	AcademicCapIcon,
	CubeIcon,
	MapIcon,
	MegaphoneIcon,
	NewspaperIcon,
	TvIcon,
	UsersIcon,
	VideoCameraIcon,
} from "@heroicons/vue/24/outline";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import NavItem from "./NavItem.vue";
import type { NavItemData } from "./NavItem.vue";
import { css } from "../../../styled-system/css";

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

const shellClass = computed(() =>
	css({
		position: "fixed",
		top: "28",
		left: { base: "4", md: "8" },
		bottom: "4",
		zIndex: "30",
		width: isCollapsed.value ? "4.75rem" : "16rem",
		display: isMobileViewport.value && isCollapsed.value ? "none" : "block",
		transition: "width 300ms cubic-bezier(0.22,1,0.36,1)",
		bg: "bg.raised/85",
		backdropFilter: "blur(24px)",
		borderRadius: "3xl",
		borderWidth: "1px",
		borderColor: "border.muted",
		boxShadow: "lg",
		overflow: "hidden",
	}),
);

const innerClass = css({
	position: "relative",
	zIndex: "1",
	display: "flex",
	height: "full",
	flexDirection: "column",
});

const navClass = css({
	flex: "1",
	overflowY: "auto",
	px: "3",
	py: "3",
	display: "flex",
	flexDirection: "column",
	gap: "2",
});

const overlayClass = css({
	position: "fixed",
	inset: "0",
	zIndex: "20",
	bg: "bg.overlay",
	backdropFilter: "blur(2px)",
	md: { display: "none" },
});
</script>

<template>
	<aside :class="shellClass" aria-label="Sidebar navigation">
		<div :class="innerClass">
			<nav :class="navClass">
				<ul style="display: flex; flex-direction: column; gap: 0.375rem;">
					<li v-for="item in navItems" :key="item.href">
						<NavItem :item="item" :is-collapsed="isCollapsed" @expand="expandSidebar" />
					</li>
				</ul>
			</nav>
		</div>
	</aside>

	<div
		v-if="!isCollapsed && isMobileViewport"
		:class="overlayClass"
		@click="toggleCollapse"
		aria-label="Close sidebar"
	></div>
</template>
