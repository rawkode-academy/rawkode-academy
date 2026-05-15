/**
 * Theme utilities.
 *
 * The site has a single brand theme — Rawkode Blue. Users can still
 * toggle light vs. dark mode. The legacy `Theme` / `setTheme` / `toggleTheme`
 * exports remain as thin shims so the existing ThemeToggle and command-palette
 * keep working until a follow-up loop replaces those UIs with a plain
 * dark-mode toggle (see DS.md).
 */

export type Theme = "rawkode-blue";

const THEME_STORAGE_KEY = "rawkode-theme";
const DARK_STORAGE_KEY = "rawkode-color-scheme";
const DEFAULT_THEME: Theme = "rawkode-blue";

export const ALL_THEMES: Theme[] = [DEFAULT_THEME];

const BRAND_COLORS = {
	primary: "#5F5ED7",
	secondary: "#00CEFF",
	accent: "#111827",
} as const;

const DISPLAY_NAME = "Rawkode Blue";

export function getTheme(): Theme {
	return DEFAULT_THEME;
}

/**
 * No-op now that there is only one theme — kept so existing callers don't break.
 * Persists the (single) theme so future loads stay deterministic.
 */
export function setTheme(_theme: Theme): void {
	if (typeof window === "undefined") return;

	document.documentElement.removeAttribute("data-theme");
	localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
	window.dispatchEvent(
		new CustomEvent("theme-change", { detail: { theme: DEFAULT_THEME } }),
	);
}

/**
 * No-op now that there is only one theme. Returns the canonical theme so
 * callers can continue to read `toggleTheme()` for display purposes.
 */
export function toggleTheme(): Theme {
	setTheme(DEFAULT_THEME);
	return DEFAULT_THEME;
}

/**
 * Initialize theme + dark-mode preference on page load.
 * Call as early as possible to avoid FOUC.
 */
export function initTheme(): void {
	if (typeof window === "undefined") return;

	// Theme is always rawkode-blue — no data-theme attribute needed.
	document.documentElement.removeAttribute("data-theme");

	const storedScheme = localStorage.getItem(DARK_STORAGE_KEY);
	const prefersDark =
		storedScheme === "dark" ||
		(storedScheme !== "light" &&
			window.matchMedia?.("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", prefersDark);
}

/**
 * Get the brand colours for the (single) theme.
 */
export function getThemeColors(): {
	primary: string;
	secondary: string;
	accent: string;
} {
	return { ...BRAND_COLORS };
}

export function getThemeDisplayName(_theme: Theme = DEFAULT_THEME): string {
	return DISPLAY_NAME;
}

/* ---------- Dark mode (the only thing users actually toggle) ---------- */

export type ColorScheme = "light" | "dark";

export function getColorScheme(): ColorScheme {
	if (typeof window === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setColorScheme(scheme: ColorScheme): void {
	if (typeof window === "undefined") return;
	document.documentElement.classList.toggle("dark", scheme === "dark");
	localStorage.setItem(DARK_STORAGE_KEY, scheme);
	window.dispatchEvent(
		new CustomEvent("color-scheme-change", { detail: { scheme } }),
	);
}

export function toggleColorScheme(): ColorScheme {
	const next: ColorScheme = getColorScheme() === "dark" ? "light" : "dark";
	setColorScheme(next);
	return next;
}
