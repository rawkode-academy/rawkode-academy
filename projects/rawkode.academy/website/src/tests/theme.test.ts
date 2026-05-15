import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ALL_THEMES,
	getTheme,
	getThemeColors,
	getThemeDisplayName,
	setTheme,
	toggleTheme,
} from "../lib/theme";

describe("Theme Management", () => {
	let originalLocalStorage: Storage;

	beforeEach(() => {
		// Setup DOM environment
		if (typeof document === "undefined") {
			global.document = {
				documentElement: {
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
		it("should contain both brand themes", () => {
			expect(ALL_THEMES).toContain("rawkode-green");
			expect(ALL_THEMES).toContain("rawkode-blue");
		});

		it("should have exactly 2 themes", () => {
			expect(ALL_THEMES).toHaveLength(2);
		});
	});

	describe("getTheme", () => {
		it("should return default theme when no theme is stored", () => {
			expect(getTheme()).toBe("rawkode-green");
		});

		it("should return stored theme when valid", () => {
			localStorage.setItem("rawkode-theme", "rawkode-blue");
			expect(getTheme()).toBe("rawkode-blue");
		});

		it("should return default theme when stored theme is invalid", () => {
			localStorage.setItem("rawkode-theme", "invalid-theme");
			expect(getTheme()).toBe("rawkode-green");
		});
	});

	describe("setTheme", () => {
		it("should store theme in localStorage", () => {
			setTheme("rawkode-blue");
			expect(localStorage.getItem("rawkode-theme")).toBe("rawkode-blue");
		});

		it("should set data-theme attribute for non-default themes", () => {
			const setAttribute = vi.fn();
			document.documentElement.setAttribute = setAttribute;

			setTheme("rawkode-blue");
			expect(setAttribute).toHaveBeenCalledWith("data-theme", "rawkode-blue");
		});

		it("should remove data-theme attribute for default theme", () => {
			const removeAttribute = vi.fn();
			document.documentElement.removeAttribute = removeAttribute;

			setTheme("rawkode-green");
			expect(removeAttribute).toHaveBeenCalledWith("data-theme");
		});
	});

	describe("toggleTheme", () => {
		it("should toggle between the two brand themes", () => {
			setTheme("rawkode-green");

			expect(toggleTheme()).toBe("rawkode-blue");
			expect(toggleTheme()).toBe("rawkode-green");
		});
	});

	describe("getThemeDisplayName", () => {
		it("should return correct display name for each theme", () => {
			expect(getThemeDisplayName("rawkode-green")).toBe("Rawkode Green");
			expect(getThemeDisplayName("rawkode-blue")).toBe("Rawkode Blue");
		});
	});

	describe("getThemeColors", () => {
		it("should return correct colors for rawkode-green", () => {
			setTheme("rawkode-green");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#04B59C");
			expect(colors.secondary).toBe("#85FF95");
			expect(colors.accent).toBe("#23282D");
		});

		it("should return correct colors for rawkode-blue", () => {
			setTheme("rawkode-blue");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#5F5ED7");
			expect(colors.secondary).toBe("#00CEFF");
			expect(colors.accent).toBe("#111827");
		});
	});
});
