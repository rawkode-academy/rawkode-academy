/**
 * Theme utilities.
 *
 * The site has a single brand theme — Rawkode Blue (defined in `:root`
 * and `html.dark` in `src/styles/global.css`). The only user-controlled
 * knob is light vs. dark mode.
 */

const DARK_STORAGE_KEY = "rawkode-color-scheme";

const BRAND_COLORS = {
	primary: "#5F5ED7",
	secondary: "#00CEFF",
	accent: "#111827",
} as const;

export type ColorScheme = "light" | "dark";

/**
 * Read the current colour scheme by inspecting the `html.dark` class.
 */
export function getColorScheme(): ColorScheme {
	if (typeof window === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Apply a colour scheme to the document and persist it.
 */
export function setColorScheme(scheme: ColorScheme): void {
	if (typeof window === "undefined") return;
	document.documentElement.classList.toggle("dark", scheme === "dark");
	localStorage.setItem(DARK_STORAGE_KEY, scheme);
	window.dispatchEvent(
		new CustomEvent("color-scheme-change", { detail: { scheme } }),
	);
}

/**
 * Flip between light and dark, returning the new scheme.
 */
export function toggleColorScheme(): ColorScheme {
	const next: ColorScheme = getColorScheme() === "dark" ? "light" : "dark";
	setColorScheme(next);
	return next;
}

/**
 * Initialise the colour scheme on page load. Call as early as possible
 * (the inline `ThemeScript.astro` does this in the document head).
 */
export function initTheme(): void {
	if (typeof window === "undefined") return;
	const stored = localStorage.getItem(DARK_STORAGE_KEY);
	const prefersDark =
		stored === "dark" ||
		(stored !== "light" &&
			window.matchMedia?.("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", prefersDark);
}

/**
 * Read the brand palette as hex strings.
 */
export function getThemeColors(): {
	primary: string;
	secondary: string;
	accent: string;
} {
	return { ...BRAND_COLORS };
}
