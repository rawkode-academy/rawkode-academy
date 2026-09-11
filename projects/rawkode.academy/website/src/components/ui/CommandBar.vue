<template>
	<header class="cmd-bar">
		<div class="cmd-bar__inner">
			<div class="cmd-bar__left">
				<slot name="leading" />
				<a class="cmd-bar__mark focus-ring" :href="logoHref" :aria-label="brandLabel">
					<span class="cmd-bar__sigil" aria-hidden="true">K</span>
					<span class="cmd-bar__wordmark">
						<span class="cmd-bar__brand">RAWKODE</span>
						<span class="cmd-bar__brand-tail">academy</span>
					</span>
				</a>
			</div>

			<nav class="cmd-bar__nav" :aria-label="navLabel">
				<a
					v-for="link in links"
					:key="link.href"
					:href="link.href"
					:class="{ 'cmd-bar__nav-link--active': isActive(link.href) }"
					:aria-current="isActive(link.href) ? 'page' : undefined"
				>
					{{ link.label }}
				</a>
			</nav>

			<div class="cmd-bar__right">
				<button
					type="button"
					class="cmd-bar__search focus-ring"
					:aria-label="searchAriaLabel"
					@click="handleSearchClick"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
						<circle cx="11" cy="11" r="7" />
						<path d="m20 20-4.35-4.35" />
					</svg>
					<span class="cmd-bar__search-hint">{{ searchPlaceholder }}</span>
					<span class="cmd-bar__keycaps">
						<kbd>{{ searchShortcut }}</kbd>
					</span>
				</button>

				<slot name="trailing">
					<a v-if="ctaHref" class="cmd-bar__cta focus-ring" :href="ctaHref">{{ ctaLabel }}</a>
				</slot>
			</div>
		</div>
	</header>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

interface NavLink {
	label: string;
	href: string;
}

const props = withDefaults(
	defineProps<{
		brand?: string;
		logoHref?: string;
		searchPlaceholder?: string;
		searchAriaLabel?: string;
		links?: NavLink[];
		ctaLabel?: string;
		ctaHref?: string;
		navLabel?: string;
		commandPaletteEvent?: string;
		currentPath?: string;
	}>(),
	{
		brand: "Rawkode Academy",
		logoHref: "/",
		searchPlaceholder: "Search",
		searchAriaLabel: "Search the Academy",
		links: () => [
			{ label: "Watch", href: "/watch" },
			{ label: "Paths", href: "/learning-paths" },
			{ label: "Courses", href: "/courses" },
			{ label: "Matrix", href: "/technology/matrix" },
			{ label: "Partnerships", href: "/organizations/partnerships" },
		],
		ctaLabel: "Sign in",
		ctaHref: "/api/auth/sign-in",
		navLabel: "Primary",
		commandPaletteEvent: "open-command-palette",
		currentPath: "/",
	},
);

const brandLabel = props.brand;
const searchShortcut = ref("⌘K");

onMounted(() => {
	const isMac = navigator.userAgent.toLowerCase().includes("mac");
	searchShortcut.value = isMac ? "⌘K" : "Ctrl+K";
});

const isActive = (href: string) => {
	const path = props.currentPath || "/";
	if (href === "/") return path === "/";
	return path === href || path.startsWith(`${href}/`);
};

const handleSearchClick = () => {
	if (typeof document === "undefined") return;
	// The CommandPaletteWrapper listens on `document` (see
	// useCommandPalette.ts), so dispatch there rather than on `window`.
	document.dispatchEvent(new CustomEvent(props.commandPaletteEvent));
};
</script>

<style scoped>
.cmd-bar {
	position: relative;
	z-index: 50;
	width: 100%;
	background: var(--ctp-mocha-mantle);
	border-bottom: 1px solid var(--ctp-mocha-surface1);
	view-transition-name: cmd-bar;
}

.cmd-bar__inner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1.25rem;
	height: 64px;
	padding: 0 1.5rem;
}

.cmd-bar__left {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-shrink: 0;
	min-width: 0;
}

.cmd-bar__mark {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	text-decoration: none;
	color: inherit;
	min-width: 0;
}

.cmd-bar__sigil {
	width: 22px;
	height: 22px;
	flex-shrink: 0;
	display: grid;
	place-items: center;
	background: var(--ctp-mocha-surface0);
	color: var(--ctp-mocha-text);
	border: 1px solid var(--ctp-mocha-surface1);
	border-radius: 2px;
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.7rem;
	font-weight: 700;
	line-height: 1;
	position: relative;
	z-index: 0;
}

/* Diagonal teal slash — Ops Console mark accent */
.cmd-bar__sigil::after {
	content: "";
	position: absolute;
	inset: 0;
	background: linear-gradient(
		135deg,
		transparent 47%,
		var(--ctp-mocha-teal) 47%,
		var(--ctp-mocha-teal) 53%,
		transparent 53%
	);
	opacity: 0.75;
	pointer-events: none;
	z-index: -1;
}

.cmd-bar__wordmark {
	display: flex;
	flex-direction: column;
	gap: 0.05rem;
	line-height: 1;
	min-width: 0;
}

.cmd-bar__brand {
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.72rem;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--ctp-mocha-text);
}

.cmd-bar__brand-tail {
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.62rem;
	font-weight: 500;
	letter-spacing: 0.16em;
	text-transform: lowercase;
	color: var(--ctp-mocha-teal);
}

.cmd-bar__nav {
	display: none;
	align-items: center;
	gap: 0.25rem;
	flex: 1;
	justify-content: center;
	min-width: 0;
}

.cmd-bar__nav a {
	display: inline-flex;
	align-items: center;
	padding: 0.4rem 0.7rem;
	border-radius: 2px;
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--ctp-mocha-subtext1);
	text-decoration: none;
	transition: color var(--duration-base) var(--ease-standard),
		background-color var(--duration-base) var(--ease-standard);
}

.cmd-bar__nav a:hover {
	color: var(--ctp-mocha-lavender);
	background: transparent;
}

.cmd-bar__nav a.cmd-bar__nav-link--active {
	background: var(--ctp-mocha-surface1);
	color: var(--ctp-mocha-text);
}

.cmd-bar__right {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	flex-shrink: 0;
}

.cmd-bar__search {
	display: none;
	align-items: center;
	gap: 0.55rem;
	height: 36px;
	min-width: 11rem;
	max-width: 16rem;
	padding: 0 0.55rem 0 0.7rem;
	background: var(--ctp-mocha-surface0);
	border: 1px solid var(--ctp-mocha-lavender);
	border-radius: 2px;
	cursor: pointer;
	font: inherit;
	color: var(--ctp-mocha-subtext0);
	transition:
		border-color var(--duration-base) var(--ease-standard),
		color var(--duration-base) var(--ease-standard);
}

.cmd-bar__search:hover {
	color: var(--ctp-mocha-text);
	border-color: var(--ctp-mocha-blue);
}

.cmd-bar__search-hint {
	flex: 1;
	min-width: 0;
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.8125rem;
	line-height: 1;
	text-align: left;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cmd-bar__keycaps {
	display: flex;
	gap: 0.2rem;
	flex-shrink: 0;
}

.cmd-bar__keycaps kbd {
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.62rem;
	font-weight: 600;
	padding: 0.14rem 0.35rem;
	border: 1px solid var(--ctp-mocha-surface2);
	border-radius: 2px;
	color: var(--ctp-mocha-overlay2);
	background: transparent;
}

.cmd-bar__cta {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 36px;
	padding: 0.5rem 0.9rem;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.6875rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	line-height: 1;
	background: var(--ctp-mocha-peach);
	color: var(--ctp-mocha-base);
	border: 1px solid var(--ctp-mocha-peach);
	border-radius: 2px;
	text-decoration: none;
	transition: opacity var(--duration-base) var(--ease-standard);
}

.cmd-bar__cta:hover {
	opacity: 0.92;
}

@media (min-width: 768px) {
	.cmd-bar__search {
		display: inline-flex;
	}
}

@media (min-width: 1080px) {
	.cmd-bar__nav {
		display: flex;
	}

	.cmd-bar__inner {
		padding: 0 2rem;
	}
}

@media (max-width: 420px) {
	.cmd-bar__inner {
		padding: 0 0.75rem;
		gap: 0.5rem;
	}

	.cmd-bar__brand-tail {
		display: none;
	}
}
</style>
