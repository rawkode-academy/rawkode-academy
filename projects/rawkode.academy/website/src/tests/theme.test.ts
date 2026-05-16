import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getColorScheme,
	getColorSchemePreference,
	getThemeColors,
	setColorScheme,
	toggleColorScheme,
} from "../lib/theme";

describe("Theme Management", () => {
	let originalLocalStorage: Storage;

	beforeEach(() => {
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
				matchMedia: () => ({
					matches: false,
					addEventListener: () => {},
					removeEventListener: () => {},
				}),
			} as unknown as Window & typeof globalThis;
		}

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

		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({
				matches: false,
				addEventListener: () => {},
				removeEventListener: () => {},
			}),
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

	describe("getThemeColors", () => {
		it("returns the rawkode-blue brand palette", () => {
			const colors = getThemeColors();
			expect(colors.primary).toBe("#5F5ED7");
			expect(colors.secondary).toBe("#00CEFF");
			expect(colors.accent).toBe("#111827");
		});
	});

	describe("ColorSchemePreference", () => {
		const stubClassList = (impl: Partial<DOMTokenList>) => {
			Object.defineProperty(document.documentElement, "classList", {
				configurable: true,
				value: impl as DOMTokenList,
			});
		};

		it("defaults to 'system' when nothing is stored", () => {
			expect(getColorSchemePreference()).toBe("system");
		});

		it("returns the stored preference when valid", () => {
			localStorage.setItem("rawkode-color-scheme", "dark");
			expect(getColorSchemePreference()).toBe("dark");

			localStorage.setItem("rawkode-color-scheme", "light");
			expect(getColorSchemePreference()).toBe("light");

			localStorage.setItem("rawkode-color-scheme", "system");
			expect(getColorSchemePreference()).toBe("system");
		});

		it("falls back to 'system' for invalid stored values", () => {
			localStorage.setItem("rawkode-color-scheme", "midnight-purple");
			expect(getColorSchemePreference()).toBe("system");
		});

		it("setColorScheme persists the preference and toggles the dark class", () => {
			const toggle = vi.fn();
			stubClassList({
				add: () => {},
				remove: () => {},
				toggle,
				contains: () => false,
			});

			setColorScheme("dark");
			expect(toggle).toHaveBeenCalledWith("dark", true);
			expect(localStorage.getItem("rawkode-color-scheme")).toBe("dark");
		});

		it("setColorScheme('system') resolves via prefers-color-scheme", () => {
			Object.defineProperty(window, "matchMedia", {
				configurable: true,
				value: () => ({
					matches: true,
					addEventListener: () => {},
					removeEventListener: () => {},
				}),
			});

			const toggle = vi.fn();
			stubClassList({
				add: () => {},
				remove: () => {},
				toggle,
				contains: () => false,
			});

			setColorScheme("system");
			expect(toggle).toHaveBeenCalledWith("dark", true);
			expect(localStorage.getItem("rawkode-color-scheme")).toBe("system");
		});

		it("toggleColorScheme cycles light → dark → system → light", () => {
			let isDark = false;
			stubClassList({
				add: () => {
					isDark = true;
				},
				remove: () => {
					isDark = false;
				},
				toggle: ((cls: string, force?: boolean) => {
					if (cls !== "dark") return isDark;
					isDark = force ?? !isDark;
					return isDark;
				}) as DOMTokenList["toggle"],
				contains: (cls: string) => cls === "dark" && isDark,
			});

			localStorage.setItem("rawkode-color-scheme", "light");
			expect(toggleColorScheme()).toBe("dark");
			expect(toggleColorScheme()).toBe("system");
			expect(toggleColorScheme()).toBe("light");
		});
	});

	describe("getColorScheme (applied)", () => {
		const stubClassList = (impl: Partial<DOMTokenList>) => {
			Object.defineProperty(document.documentElement, "classList", {
				configurable: true,
				value: impl as DOMTokenList,
			});
		};

		it("reads 'light' when html.dark is absent", () => {
			stubClassList({
				add: () => {},
				remove: () => {},
				toggle: () => false,
				contains: () => false,
			});
			expect(getColorScheme()).toBe("light");
		});

		it("reads 'dark' when html.dark is present", () => {
			stubClassList({
				add: () => {},
				remove: () => {},
				toggle: () => true,
				contains: (cls: string) => cls === "dark",
			});
			expect(getColorScheme()).toBe("dark");
		});
	});
});
