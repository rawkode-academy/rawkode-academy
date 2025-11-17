/**
 * Theme Management Utility
 * Handles theme switching between multiple color themes
 */

export type Theme =
	| "rawkode-green"
	| "rawkode-blue"
	| "catppuccin"
	| "dracula"
	| "solarized"
	| "pride"
	| "lgbtq";

const THEME_STORAGE_KEY = "rawkode-theme";
const DEFAULT_THEME: Theme = "catppuccin";

// All available themes for cycling/rotation
export const ALL_THEMES: Theme[] = [
	"rawkode-green",
	"rawkode-blue",
	"catppuccin",
	"dracula",
	"solarized",
	"pride",
	"lgbtq",
];

/**
 * Get the current theme from localStorage or return default
 */
export function getTheme(): Theme {
	if (typeof window === "undefined") return DEFAULT_THEME;

	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	if (stored && ALL_THEMES.includes(stored as Theme)) {
		return stored as Theme;
	}

	return DEFAULT_THEME;
}

/**
 * Set the theme and persist to localStorage
 */
export function setTheme(theme: Theme): void {
	if (typeof window === "undefined") return;

	// Update data attribute on root element
	if (theme === "rawkode-green") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", theme);
	}

	// Persist to localStorage
	localStorage.setItem(THEME_STORAGE_KEY, theme);

	// Dispatch custom event for components to listen to
	window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme } }));
}

/**
 * Toggle between themes (cycles through all available themes)
 */
export function toggleTheme(): Theme {
	const current = getTheme();
	const currentIndex = ALL_THEMES.indexOf(current);
	const nextIndex = (currentIndex + 1) % ALL_THEMES.length;
	const next = ALL_THEMES[nextIndex] || DEFAULT_THEME;
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
	if (theme !== "rawkode-green") {
		document.documentElement.setAttribute("data-theme", theme);
	}
}

const THEME_COLORS: Record<
	Theme,
	{ primary: string; secondary: string; accent: string }
> = {
	"rawkode-green": {
		primary: "#04B59C",
		secondary: "#85FF95",
		accent: "#23282D",
	},
	"rawkode-blue": {
		primary: "#5F5ED7",
		secondary: "#00CEFF",
		accent: "#111827",
	},
	catppuccin: {
		primary: "#CBA6F7",
		secondary: "#F5C2E7",
		accent: "#1E1E2E",
	},
	dracula: {
		primary: "#BD93F9",
		secondary: "#FF79C6",
		accent: "#282A36",
	},
	solarized: {
		primary: "#268BD2",
		secondary: "#2AA198",
		accent: "#002B36",
	},
	pride: {
		primary: "#FF595E",
		secondary: "#FFCA3A",
		accent: "#6A4C93",
	},
	lgbtq: {
		primary: "#5BCEFA",
		secondary: "#F5A9B8",
		accent: "#FFFFFF",
	},
};

const THEME_DISPLAY_NAMES: Record<Theme, string> = {
	"rawkode-green": "Rawkode Green",
	"rawkode-blue": "Rawkode Blue",
	catppuccin: "Catppuccin",
	dracula: "Dracula",
	solarized: "Solarized",
	pride: "Pride",
	lgbtq: "LGBTQ+",
};

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
	return THEME_COLORS[theme];
}

/**
 * Get theme display name
 */
export function getThemeDisplayName(theme: Theme): string {
	return THEME_DISPLAY_NAMES[theme];
}
