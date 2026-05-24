<script setup lang="ts">
import {
	AcademicCapIcon,
	CubeIcon,
	MapIcon,
	MegaphoneIcon,
	NewspaperIcon,
	Squares2X2Icon,
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
const isResizing = ref(false);
const collapseStorageKey = "sidebar-collapsed";
const widthStorageKey = "sidebar-expanded-width";
const defaultExpandedWidth = 288;
const minExpandedWidth = 224;
const maxExpandedWidth = 440;
const expandedWidth = ref(defaultExpandedWidth);

const baseItems: RawNavItem[] = [
	{ name: "News", href: "/news", icon: MegaphoneIcon },
	{ name: "Technology Matrix", href: "/technology/matrix", icon: Squares2X2Icon },
	{ name: "Videos", href: "/watch", icon: VideoCameraIcon },
	{ name: "Articles", href: "/read", icon: NewspaperIcon },
	{ name: "Learning Paths", href: "/learning-paths", icon: MapIcon },
	{ name: "Courses", href: "/courses", icon: AcademicCapIcon },
	{ name: "Shows", href: "/shows", icon: TvIcon },
	{ name: "People", href: "/people", icon: UsersIcon },
	{ name: "Technologies", href: "/technology", icon: CubeIcon },
];

onMounted(() => {
	currentPath.value = window.location.pathname;
	expandedWidth.value = readStoredExpandedWidth();
	syncViewportState();

	if (!isMobileViewport.value) {
		isCollapsed.value = localStorage.getItem(collapseStorageKey) === "true";
	}

	applySidebarWidth();
	window.addEventListener("toggle-sidebar", handleSidebarToggle);
	window.addEventListener("resize", syncViewportState, { passive: true });
});

onBeforeUnmount(() => {
	window.removeEventListener("toggle-sidebar", handleSidebarToggle);
	window.removeEventListener("resize", syncViewportState);
	window.removeEventListener("pointermove", handleResizeMove);
	window.removeEventListener("pointerup", stopResize);
	document.body.classList.remove("ed-sidebar-resizing");
});

function isCurrentPath(itemPath: string) {
	if (itemPath === "/" && currentPath.value === "/") return true;
	if (itemPath === "/technology") {
		return (
			currentPath.value === "/technology" ||
			(currentPath.value.startsWith("/technology/") &&
				!currentPath.value.startsWith("/technology/matrix"))
		);
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
	expandedWidth.value = clampWidth(expandedWidth.value);

	if (nextIsMobile) {
		isCollapsed.value = true;
		applySidebarWidth();
		return;
	}

	if (viewportChanged) {
		isCollapsed.value = localStorage.getItem(collapseStorageKey) === "true";
	}

	applySidebarWidth();
}

function persistCollapseState() {
	if (!isMobileViewport.value) {
		localStorage.setItem(collapseStorageKey, String(isCollapsed.value));
	}
}

function handleSidebarToggle() {
	isCollapsed.value = !isCollapsed.value;
	persistCollapseState();
	applySidebarWidth();
}

const toggleCollapse = () => {
	isCollapsed.value = !isCollapsed.value;
	persistCollapseState();
	applySidebarWidth();
};

const expandSidebar = () => {
	isCollapsed.value = false;
	persistCollapseState();
	applySidebarWidth();
};

function maxWidthForViewport() {
	return Math.min(maxExpandedWidth, Math.max(minExpandedWidth, Math.floor(window.innerWidth * 0.42)));
}

function clampWidth(width: number) {
	return Math.min(Math.max(width, minExpandedWidth), maxWidthForViewport());
}

function readStoredExpandedWidth() {
	const stored = Number.parseInt(localStorage.getItem(widthStorageKey) || "", 10);
	if (!Number.isFinite(stored)) return defaultExpandedWidth;
	return clampWidth(stored);
}

function applySidebarWidth() {
	const root = document.documentElement;
	const width = `${Math.round(expandedWidth.value)}px`;
	root.style.setProperty("--ed-sidebar-expanded-width", width);
	root.style.setProperty(
		"--ed-sidebar-current-width",
		isMobileViewport.value || isCollapsed.value
			? "var(--ed-sidebar-collapsed-width, 3.5rem)"
			: width,
	);
}

function startResize(event: PointerEvent) {
	if (isCollapsed.value || isMobileViewport.value) return;
	event.preventDefault();
	isResizing.value = true;
	document.body.classList.add("ed-sidebar-resizing");
	window.addEventListener("pointermove", handleResizeMove);
	window.addEventListener("pointerup", stopResize);
}

function handleResizeMove(event: PointerEvent) {
	if (!isResizing.value) return;
	expandedWidth.value = clampWidth(event.clientX);
	applySidebarWidth();
}

function stopResize() {
	if (!isResizing.value) return;
	isResizing.value = false;
	document.body.classList.remove("ed-sidebar-resizing");
	localStorage.setItem(widthStorageKey, String(Math.round(expandedWidth.value)));
	window.removeEventListener("pointermove", handleResizeMove);
	window.removeEventListener("pointerup", stopResize);
	applySidebarWidth();
}

function resizeBy(delta: number) {
	expandedWidth.value = clampWidth(expandedWidth.value + delta);
	localStorage.setItem(widthStorageKey, String(Math.round(expandedWidth.value)));
	applySidebarWidth();
}

function handleResizeKeydown(event: KeyboardEvent) {
	if (isCollapsed.value || isMobileViewport.value) return;

	if (event.key === "ArrowLeft") {
		event.preventDefault();
		resizeBy(-16);
	}

	if (event.key === "ArrowRight") {
		event.preventDefault();
		resizeBy(16);
	}

	if (event.key === "Home") {
		event.preventDefault();
		expandedWidth.value = minExpandedWidth;
		localStorage.setItem(widthStorageKey, String(expandedWidth.value));
		applySidebarWidth();
	}

	if (event.key === "End") {
		event.preventDefault();
		expandedWidth.value = maxWidthForViewport();
		localStorage.setItem(widthStorageKey, String(expandedWidth.value));
		applySidebarWidth();
	}
}
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
			<span class="ed-sidebar__index-label">
				{{ isCollapsed ? "Nav" : "Navigation" }}
			</span>
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

		<div
			v-show="!isCollapsed && !isMobileViewport"
			class="ed-sidebar__resize-handle"
			role="separator"
			tabindex="0"
			aria-label="Resize sidebar"
			aria-orientation="vertical"
			:aria-valuemin="minExpandedWidth"
			:aria-valuemax="maxWidthForViewport()"
			:aria-valuenow="Math.round(expandedWidth)"
			@pointerdown="startResize"
			@keydown="handleResizeKeydown"
		></div>
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

.ed-sidebar--expanded { width: var(--ed-sidebar-expanded-width, 18rem); }
.ed-sidebar--collapsed { width: var(--ed-sidebar-collapsed-width, 3.5rem); }

.ed-sidebar--expanded.ed-sidebar {
	min-width: var(--ed-sidebar-expanded-width, 18rem);
}

.ed-sidebar__resize-handle {
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 2;
	width: 0.75rem;
	cursor: col-resize;
	touch-action: none;
	outline: none;
}

.ed-sidebar__resize-handle::before {
	content: "";
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	width: 1px;
	background: var(--editorial-hairline);
}

.ed-sidebar__resize-handle::after {
	content: "";
	position: absolute;
	top: 50%;
	right: 0.25rem;
	width: 2px;
	height: 2.5rem;
	background: color-mix(in oklab, var(--editorial-ink-mute) 60%, transparent);
	transform: translateY(-50%);
	opacity: 0;
	transition: opacity var(--duration-base) var(--ease-standard);
}

.ed-sidebar__resize-handle:hover::after,
.ed-sidebar__resize-handle:focus-visible::after {
	opacity: 1;
}

:global(body.ed-sidebar-resizing) {
	cursor: col-resize;
	user-select: none;
}

:global(body.ed-sidebar-resizing) .ed-sidebar {
	transition: none;
}

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
