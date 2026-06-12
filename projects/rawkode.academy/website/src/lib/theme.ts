/**
 * Theme utilities.
 *
 * The site has a single brand theme - the editorial palette (defined in
 * `:root` and `html.dark` in `src/styles/global.css`). The only
 * user-controlled knob is the colour-scheme preference: light, dark, or
 * system.
 *
 * Concepts:
 *   - `ColorScheme`             - the *applied* mode on the page (light | dark).
 *   - `ColorSchemePreference`   - the user's *stored* choice
 *                                 (light | dark | system). "system" defers
 *                                 to the OS `prefers-color-scheme` media query.
 */

const PREF_STORAGE_KEY = "rawkode-color-scheme";

/**
 * Light-mode brand palette as sRGB hex approximations of the editorial
 * oklch tokens in `global.css`:
 *   primary   = spruce     - oklch(0.50 0.09 165)
 *   secondary = amber-text - oklch(0.52 0.13 65)
 *   accent    = rust       - oklch(0.52 0.13 40)
 */
const BRAND_COLORS = {
	primary: "#237356",
	secondary: "#9A5500",
	accent: "#A54A28",
} as const;

export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = ColorScheme | "system";

const DEFAULT_PREFERENCE: ColorSchemePreference = "system";

const PREFERENCES: readonly ColorSchemePreference[] = [
	"light",
	"dark",
	"system",
];

const isValidPreference = (
	value: string | null,
): value is ColorSchemePreference =>
	value !== null && PREFERENCES.includes(value as ColorSchemePreference);

const systemMediaQuery = (): MediaQueryList | null => {
	if (typeof window === "undefined" || !window.matchMedia) return null;
	return window.matchMedia("(prefers-color-scheme: dark)");
};

/** Resolve a preference to the applied colour scheme. */
function resolvePreference(pref: ColorSchemePreference): ColorScheme {
	if (pref === "system") {
		return systemMediaQuery()?.matches ? "dark" : "light";
	}
	return pref;
}

/**
 * Read the stored colour-scheme preference (light, dark, or system).
 * Defaults to "system" when nothing is stored.
 */
export function getColorSchemePreference(): ColorSchemePreference {
	if (typeof window === "undefined") return DEFAULT_PREFERENCE;
	const stored = localStorage.getItem(PREF_STORAGE_KEY);
	return isValidPreference(stored) ? stored : DEFAULT_PREFERENCE;
}

/**
 * Read the *applied* colour scheme from the document - i.e. whether
 * `html.dark` is currently set.
 */
export function getColorScheme(): ColorScheme {
	if (typeof window === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Apply a resolved scheme to the document without touching the preference. */
function applyColorScheme(scheme: ColorScheme): void {
	if (typeof window === "undefined") return;
	document.documentElement.classList.toggle("dark", scheme === "dark");
}

/**
 * Set the colour-scheme preference, persist it, and apply the resolved
 * scheme. Pass "system" to follow the OS preference.
 */
export function setColorScheme(pref: ColorSchemePreference): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(PREF_STORAGE_KEY, pref);
	const resolved = resolvePreference(pref);
	applyColorScheme(resolved);
	window.dispatchEvent(
		new CustomEvent("color-scheme-change", {
			detail: { preference: pref, scheme: resolved },
		}),
	);
}

/**
 * Cycle the preference: light → dark → system → light. Returns the new
 * preference.
 */
export function toggleColorScheme(): ColorSchemePreference {
	const current = getColorSchemePreference();
	const index = PREFERENCES.indexOf(current);
	const next = PREFERENCES[(index + 1) % PREFERENCES.length] ?? "system";
	setColorScheme(next);
	return next;
}

let systemMediaListener: ((event: MediaQueryListEvent) => void) | null = null;

/**
 * Initialise the colour scheme on page load. Apply the stored preference
 * (or the default), then install a listener so OS theme changes are
 * reflected while preference is "system".
 *
 * Call as early as possible - the inline `ThemeScript.astro` mirrors
 * this so the right class is applied before paint.
 */
export function initTheme(): void {
	if (typeof window === "undefined") return;

	const pref = getColorSchemePreference();
	applyColorScheme(resolvePreference(pref));

	const mq = systemMediaQuery();
	if (!mq) return;

	if (systemMediaListener) {
		mq.removeEventListener("change", systemMediaListener);
	}

	systemMediaListener = (event) => {
		if (getColorSchemePreference() !== "system") return;
		const resolved: ColorScheme = event.matches ? "dark" : "light";
		applyColorScheme(resolved);
		window.dispatchEvent(
			new CustomEvent("color-scheme-change", {
				detail: { preference: "system", scheme: resolved },
			}),
		);
	};

	mq.addEventListener("change", systemMediaListener);
}

/** Read the brand palette as hex strings. */
export function getThemeColors(): {
	primary: string;
	secondary: string;
	accent: string;
} {
	return { ...BRAND_COLORS };
}
