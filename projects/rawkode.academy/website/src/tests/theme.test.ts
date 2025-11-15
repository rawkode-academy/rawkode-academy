import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	getTheme,
	setTheme,
	toggleTheme,
	getThemeDisplayName,
	getThemeColors,
	ALL_THEMES,
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
			} as any;
		}

		if (typeof window === "undefined") {
			global.window = {
				localStorage: {
					getItem: () => null,
					setItem: () => {},
					removeItem: () => {},
				},
				dispatchEvent: () => true,
			} as any;
		}

		// Mock localStorage
		originalLocalStorage = window.localStorage;
		const localStorageMock = {
			store: {} as Record<string, string>,
			getItem(key: string) {
				return this.store[key] || null;
			},
			setItem(key: string, value: string) {
				this.store[key] = value;
			},
			removeItem(key: string) {
				delete this.store[key];
			},
			clear() {
				this.store = {};
			},
		};
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
		it("should contain all expected themes", () => {
			expect(ALL_THEMES).toContain("rawkode-green");
			expect(ALL_THEMES).toContain("rawkode-blue");
			expect(ALL_THEMES).toContain("catppuccin");
			expect(ALL_THEMES).toContain("dracula");
			expect(ALL_THEMES).toContain("solarized");
			expect(ALL_THEMES).toContain("pride");
			expect(ALL_THEMES).toContain("lgbtq");
		});

		it("should have exactly 7 themes", () => {
			expect(ALL_THEMES).toHaveLength(7);
		});
	});

	describe("getTheme", () => {
		it("should return default theme when no theme is stored", () => {
			expect(getTheme()).toBe("rawkode-green");
		});

		it("should return stored theme when valid", () => {
			localStorage.setItem("rawkode-theme", "dracula");
			expect(getTheme()).toBe("dracula");
		});

		it("should return default theme when stored theme is invalid", () => {
			localStorage.setItem("rawkode-theme", "invalid-theme");
			expect(getTheme()).toBe("rawkode-green");
		});
	});

	describe("setTheme", () => {
		it("should store theme in localStorage", () => {
			setTheme("catppuccin");
			expect(localStorage.getItem("rawkode-theme")).toBe("catppuccin");
		});

		it("should set data-theme attribute for non-default themes", () => {
			const setAttribute = vi.fn();
			document.documentElement.setAttribute = setAttribute;

			setTheme("dracula");
			expect(setAttribute).toHaveBeenCalledWith("data-theme", "dracula");
		});

		it("should remove data-theme attribute for default theme", () => {
			const removeAttribute = vi.fn();
			document.documentElement.removeAttribute = removeAttribute;

			setTheme("rawkode-green");
			expect(removeAttribute).toHaveBeenCalledWith("data-theme");
		});
	});

	describe("toggleTheme", () => {
		it("should cycle through all themes in order", () => {
			setTheme("rawkode-green");

			expect(toggleTheme()).toBe("rawkode-blue");
			expect(toggleTheme()).toBe("catppuccin");
			expect(toggleTheme()).toBe("dracula");
			expect(toggleTheme()).toBe("solarized");
			expect(toggleTheme()).toBe("pride");
			expect(toggleTheme()).toBe("lgbtq");
			expect(toggleTheme()).toBe("rawkode-green"); // Back to start
		});
	});

	describe("getThemeDisplayName", () => {
		it("should return correct display name for each theme", () => {
			expect(getThemeDisplayName("rawkode-green")).toBe("Rawkode Green");
			expect(getThemeDisplayName("rawkode-blue")).toBe("Rawkode Blue");
			expect(getThemeDisplayName("catppuccin")).toBe("Catppuccin");
			expect(getThemeDisplayName("dracula")).toBe("Dracula");
			expect(getThemeDisplayName("solarized")).toBe("Solarized");
			expect(getThemeDisplayName("pride")).toBe("Pride");
			expect(getThemeDisplayName("lgbtq")).toBe("LGBTQ+");
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

		it("should return correct colors for catppuccin", () => {
			setTheme("catppuccin");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#CBA6F7");
			expect(colors.secondary).toBe("#F5C2E7");
			expect(colors.accent).toBe("#1E1E2E");
		});

		it("should return correct colors for dracula", () => {
			setTheme("dracula");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#BD93F9");
			expect(colors.secondary).toBe("#FF79C6");
			expect(colors.accent).toBe("#282A36");
		});

		it("should return correct colors for solarized", () => {
			setTheme("solarized");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#268BD2");
			expect(colors.secondary).toBe("#2AA198");
			expect(colors.accent).toBe("#002B36");
		});

		it("should return correct colors for pride", () => {
			setTheme("pride");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#FF595E");
			expect(colors.secondary).toBe("#FFCA3A");
			expect(colors.accent).toBe("#6A4C93");
		});

		it("should return correct colors for lgbtq", () => {
			setTheme("lgbtq");
			const colors = getThemeColors();
			expect(colors.primary).toBe("#5BCEFA");
			expect(colors.secondary).toBe("#F5A9B8");
			expect(colors.accent).toBe("#FFFFFF");
		});
	});
});
