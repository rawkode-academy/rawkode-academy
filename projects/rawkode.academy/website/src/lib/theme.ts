/**
 * Theme management for design system v2.
 *
 * The site is single-brand (rawkode-blue: purple + cyan). The only thing
 * the user toggles is colour mode: `light` or `dark`. Mode is applied via
 * a `.dark` class on `<html>` so Panda's `_dark` condition can target it.
 *
 * Persistence: localStorage `rawkode-mode`. Fallback: `prefers-color-scheme`.
 */

export type Mode = "light" | "dark";

const MODE_STORAGE_KEY = "rawkode-mode";

/** Read the user's preferred mode from localStorage or the OS. */
export function getMode(): Mode {
	if (typeof window === "undefined") return "dark";

	try {
		const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
		if (stored === "light" || stored === "dark") {
			return stored;
		}
	} catch {
		// localStorage unavailable; fall through to OS preference.
	}

	return window.matchMedia?.("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

/** Apply a mode to the document and persist the choice. */
export function setMode(mode: Mode): void {
	if (typeof window === "undefined") return;

	document.documentElement.classList.toggle("dark", mode === "dark");

	try {
		window.localStorage.setItem(MODE_STORAGE_KEY, mode);
	} catch {
		// Persistence is best-effort.
	}

	window.dispatchEvent(
		new CustomEvent<{ mode: Mode }>("mode-change", { detail: { mode } }),
	);
}

/** Flip the current mode and return the new value. */
export function toggleMode(): Mode {
	const next: Mode = getMode() === "dark" ? "light" : "dark";
	setMode(next);
	return next;
}

/**
 * Apply the persisted or OS-preferred mode before paint.
 * Safe to call from an inline script in <head>; idempotent everywhere else.
 */
export function initMode(): void {
	if (typeof window === "undefined") return;
	const mode = getMode();
	document.documentElement.classList.toggle("dark", mode === "dark");
}
