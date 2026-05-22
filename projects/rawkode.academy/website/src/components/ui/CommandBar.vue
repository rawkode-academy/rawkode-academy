<template>
	<header class="cmd-bar">
		<a class="cmd-bar__mark" :href="logoHref" :aria-label="brand">
			<span class="cmd-bar__sigil">R</span>
			<span class="cmd-bar__wordmark">
				{{ brand }}<span class="cmd-bar__wordmark-tail">/academy</span>
			</span>
		</a>

		<button
			type="button"
			class="cmd-bar__pill"
			:aria-label="searchPlaceholder"
			@click="handleSearchClick"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-4.35-4.35" />
			</svg>
			<span class="cmd-bar__pill-prompt">
				<span class="cmd-bar__pill-caret">›</span>
				{{ searchPlaceholder }}
				<span class="cmd-bar__pill-cursor">_</span>
			</span>
			<span class="cmd-bar__keycaps">
				<kbd>⌘</kbd><kbd>K</kbd>
			</span>
		</button>

		<nav class="cmd-bar__nav" :aria-label="navLabel">
			<a v-for="link in links" :key="link.href" :href="link.href">{{ link.label }}</a>
		</nav>

		<a v-if="ctaHref" class="cmd-bar__cta" :href="ctaHref">{{ ctaLabel }}</a>

		<slot name="trailing" />
	</header>
</template>

<script setup lang="ts">
interface NavLink { label: string; href: string }

const props = withDefaults(
	defineProps<{
		brand?: string;
		logoHref?: string;
		searchPlaceholder?: string;
		links?: NavLink[];
		ctaLabel?: string;
		ctaHref?: string;
		navLabel?: string;
		commandPaletteEvent?: string;
	}>(),
	{
		brand: "Rawkode",
		logoHref: "/",
		searchPlaceholder: "Search lessons, topics, instructors",
		links: () => [
			{ label: "Courses", href: "/courses" },
			{ label: "Live", href: "/watch" },
			{ label: "Dispatch", href: "/read" },
			{ label: "Schedule", href: "/shows" },
		],
		ctaLabel: "Sign in",
		ctaHref: "/settings",
		navLabel: "Primary",
		commandPaletteEvent: "open-command-palette",
	},
);

const handleSearchClick = () => {
	if (typeof document === "undefined") return;
	// The CommandPaletteWrapper listens on `document` (see
	// useCommandPalette.ts), so dispatch there rather than on `window`.
	// Dispatching on window silently fails — events don't cross trees.
	document.dispatchEvent(new CustomEvent(props.commandPaletteEvent));
};
</script>

<style scoped>
.cmd-bar {
	display: flex;
	align-items: center;
	gap: 1.5rem;
	height: 66px;
	padding: 0 2.5rem;
	border-bottom: 1px solid var(--editorial-hairline);
	background: var(--editorial-paper);
}

.cmd-bar__mark {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	text-decoration: none;
	flex-shrink: 0;
	color: inherit;
}

.cmd-bar__sigil {
	width: 24px;
	height: 24px;
	background: var(--editorial-ink);
	color: var(--editorial-paper);
	display: grid;
	place-items: center;
	border-radius: 1px;
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-size: 17px;
	line-height: 1;
	margin-top: -1px;
}

.cmd-bar__wordmark {
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 12px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.3em;
	color: var(--editorial-ink);
}

.cmd-bar__wordmark-tail {
	color: var(--editorial-ink-mute);
	font-weight: 400;
}

.cmd-bar__pill {
	flex: 1;
	max-width: 720px;
	margin: 0 auto;
	height: 42px;
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0 0.875rem 0 1rem;
	background: var(--editorial-paper-deep);
	border: 1px solid var(--editorial-hairline);
	border-radius: var(--radius-sm);
	cursor: pointer;
	font: inherit;
	color: var(--editorial-ink-mute);
	transition: border-color var(--duration-base) var(--ease-standard);
}

.cmd-bar__pill:hover { border-color: var(--editorial-hairline-strong); }

.cmd-bar__pill-prompt {
	flex: 1;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 13px;
	letter-spacing: 0.05em;
	text-align: left;
	color: var(--editorial-ink-mute);
}

.cmd-bar__pill-caret { color: var(--editorial-ink); margin-right: 0.25rem; }
.cmd-bar__pill-cursor { color: var(--editorial-rust); margin-left: 0.4rem; }

.cmd-bar__keycaps { display: flex; gap: 0.25rem; }
.cmd-bar__keycaps kbd {
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 11px;
	padding: 0.2rem 0.45rem;
	border: 1px solid var(--editorial-hairline-strong);
	border-radius: 2px;
	color: var(--editorial-ink-soft);
	background: transparent;
}

.cmd-bar__nav {
	display: flex;
	gap: 1.4rem;
	flex-shrink: 0;
}
.cmd-bar__nav a {
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 11.5px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	font-weight: 500;
	color: var(--editorial-ink-soft);
	text-decoration: none;
	transition: color var(--duration-base) var(--ease-standard);
}
.cmd-bar__nav a:hover { color: var(--editorial-ink); }

.cmd-bar__cta {
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 11.5px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	font-weight: 600;
	padding: 0.625rem 1.125rem;
	background: var(--editorial-ink);
	color: var(--editorial-paper);
	border: 1px solid var(--editorial-ink);
	border-radius: 2px;
	text-decoration: none;
	transition: opacity var(--duration-base) var(--ease-standard);
}
.cmd-bar__cta:hover { opacity: 0.92; }
</style>
