import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ALL_THEMES,
	getColorScheme,
	getTheme,
	getThemeColors,
	getThemeDisplayName,
	setColorScheme,
	setTheme,
	toggleColorScheme,
	toggleTheme,
} from "../lib/theme";

describe("Theme Management", () => {
	let originalLocalStorage: Storage;

	beforeEach(() => {
		// Setup DOM environment
		if (typeof document === "undefined") {
			global.document = {
				documentElement: {
					classList: {
						add: () => {},
						remove: () => {},
						toggle: () => {},
						contains: () => false,
					},
					setAttribute: () => {},
					removeAttribute: () => {},
				},
			} as unknown as Document;
		}

		if (typeof window === "undefined") {
			global.window = {
				localStorage: {
					getItem: () => null,
					setItem: () => {},
					removeItem: () => {},
					clear: () => {},
					key: () => null,
					length: 0,
				} as Storage,
				dispatchEvent: () => true,
				addEventListener: () => {},
				removeEventListener: () => {},
				matchMedia: () => ({ matches: false }),
			} as unknown as Window & typeof globalThis;
		}

		// Mock localStorage
		originalLocalStorage = window.localStorage;
		const localStorageMock: Storage = (() => {
			const store: Record<string, string> = {};
			return {
				get length() {
					return Object.keys(store).length;
				},
				clear() {
					for (const key of Object.keys(store)) {
						delete store[key];
					}
				},
				getItem(key: string) {
					return store[key] ?? null;
				},
				key(index: number) {
					return Object.keys(store)[index] ?? null;
				},
				removeItem(key: string) {
					delete store[key];
				},
				setItem(key: string, value: string) {
					store[key] = value;
				},
			} as Storage;
		})();
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			writable: true,
		});
	});

	afterEach(() => {
		if (originalLocalStorage) {
			Object.defineProperty(window, "localStorage", {
				value: originalLocalStorage,
				writable: true,
			});
		}
	});

	describe("ALL_THEMES", () => {
		it("should contain only the canonical brand theme", () => {
			expect(ALL_THEMES).toEqual(["rawkode-blue"]);
		});
	});

	describe("getTheme", () => {
		it("always returns rawkode-blue", () => {
			expect(getTheme()).toBe("rawkode-blue");
		});
	});

	describe("setTheme", () => {
		it("removes any stale data-theme attribute", () => {
			const removeAttribute = vi.fn();
			document.documentElement.removeAttribute = removeAttribute;

			setTheme("rawkode-blue");
			expect(removeAttribute).toHaveBeenCalledWith("data-theme");
		});

		it("persists the canonical theme to localStorage", () => {
			setTheme("rawkode-blue");
			expect(localStorage.getItem("rawkode-theme")).toBe("rawkode-blue");
		});
	});

	describe("toggleTheme", () => {
		it("is a no-op that returns the canonical theme", () => {
			expect(toggleTheme()).toBe("rawkode-blue");
		});
	});

	describe("getThemeDisplayName", () => {
		it("returns the canonical brand name", () => {
			expect(getThemeDisplayName("rawkode-blue")).toBe("Rawkode Blue");
		});
	});

	describe("getThemeColors", () => {
		it("returns the rawkode-blue brand palette", () => {
			const colors = getThemeColors();
			expect(colors.primary).toBe("#5F5ED7");
			expect(colors.secondary).toBe("#00CEFF");
			expect(colors.accent).toBe("#111827");
		});
	});

	describe("ColorScheme (light / dark)", () => {
		it("reads light by default", () => {
			document.documentElement.classList = {
				add: () => {},
				remove: () => {},
				toggle: () => {},
				contains: () => false,
			} as unknown as DOMTokenList;
			expect(getColorScheme()).toBe("light");
		});

		it("setColorScheme persists and toggles the dark class", () => {
			const toggle = vi.fn();
			document.documentElement.classList = {
				add: () => {},
				remove: () => {},
				toggle,
				contains: () => false,
			} as unknown as DOMTokenList;

			setColorScheme("dark");
			expect(toggle).toHaveBeenCalledWith("dark", true);
			expect(localStorage.getItem("rawkode-color-scheme")).toBe("dark");
		});

		it("toggleColorScheme flips the active mode", () => {
			let isDark = false;
			document.documentElement.classList = {
				add: () => {
					isDark = true;
				},
				remove: () => {
					isDark = false;
				},
				toggle: (cls: string, force?: boolean) => {
					if (cls !== "dark") return;
					isDark = force ?? !isDark;
				},
				contains: (cls: string) => cls === "dark" && isDark,
			} as unknown as DOMTokenList;

			expect(toggleColorScheme()).toBe("dark");
			expect(toggleColorScheme()).toBe("light");
		});
	});
});
