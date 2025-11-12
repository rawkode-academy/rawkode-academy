/**
 * Theme Management Utility
 * Handles theme switching between rawkode-green (default) and rawkode-blue
 */

export type Theme = "rawkode-green" | "rawkode-blue";

const THEME_STORAGE_KEY = "rawkode-theme";
const DEFAULT_THEME: Theme = "rawkode-green";

/**
 * Get the current theme from localStorage or return default
 */
export function getTheme(): Theme {
	if (typeof window === "undefined") return DEFAULT_THEME;

	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	if (stored === "rawkode-green" || stored === "rawkode-blue") {
		return stored;
	}

	return DEFAULT_THEME;
}

/**
 * Set the theme and persist to localStorage
 */
export function setTheme(theme: Theme): void {
	if (typeof window === "undefined") return;

	// Update data attribute on root element
	if (theme === "rawkode-blue") {
		document.documentElement.setAttribute("data-theme", "rawkode-blue");
	} else {
		document.documentElement.removeAttribute("data-theme");
	}

	// Persist to localStorage
	localStorage.setItem(THEME_STORAGE_KEY, theme);

	// Dispatch custom event for components to listen to
	window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme } }));
}

/**
 * Toggle between themes
 */
export function toggleTheme(): Theme {
	const current = getTheme();
	const next: Theme =
		current === "rawkode-green" ? "rawkode-blue" : "rawkode-green";
	setTheme(next);
	return next;
}

/**
 * Initialize theme on page load
 * Should be called as early as possible to avoid flash
 */
export function initTheme(): void {
	if (typeof window === "undefined") return;

	const theme = getTheme();
	if (theme === "rawkode-blue") {
		document.documentElement.setAttribute("data-theme", "rawkode-blue");
	}
}

/**
 * Get theme colors for current theme
 */
export function getThemeColors(): {
	primary: string;
	secondary: string;
	accent: string;
} {
	if (typeof window === "undefined") {
		return {
			primary: "#04B59C",
			secondary: "#85FF95",
			accent: "#23282D",
		};
	}

	const theme = getTheme();

	if (theme === "rawkode-blue") {
		return {
			primary: "#5F5ED7",
			secondary: "#00CEFF",
			accent: "#111827",
		};
	}

	return {
		primary: "#04B59C",
		secondary: "#85FF95",
		accent: "#23282D",
	};
}
