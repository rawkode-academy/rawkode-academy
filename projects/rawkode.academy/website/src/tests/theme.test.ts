import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMode, setMode, toggleMode } from "../lib/theme";

describe("Mode management", () => {
	const original = {
		localStorage: typeof window !== "undefined" ? window.localStorage : null,
	};

	beforeEach(() => {
		if (typeof document === "undefined") {
			global.document = {
				documentElement: { classList: { toggle: () => {} } },
			} as unknown as Document;
		}
		if (typeof window === "undefined") {
			global.window = {
				dispatchEvent: () => true,
				addEventListener: () => {},
				removeEventListener: () => {},
				matchMedia: () => ({ matches: false }),
			} as unknown as Window & typeof globalThis;
		}

		const store: Record<string, string> = {};
		const fakeStorage: Storage = {
			get length() {
				return Object.keys(store).length;
			},
			clear() {
				for (const k of Object.keys(store)) delete store[k];
			},
			getItem: (k) => store[k] ?? null,
			setItem: (k, v) => {
				store[k] = v;
			},
			removeItem: (k) => {
				delete store[k];
			},
			key: (i) => Object.keys(store)[i] ?? null,
		};
		Object.defineProperty(window, "localStorage", {
			value: fakeStorage,
			configurable: true,
		});

		vi.spyOn(document.documentElement.classList, "toggle");
		vi.spyOn(window, "dispatchEvent");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (original.localStorage) {
			Object.defineProperty(window, "localStorage", {
				value: original.localStorage,
				configurable: true,
			});
		}
	});

	it("falls back to prefers-color-scheme when nothing is stored", () => {
		(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
			((_query: string) =>
				({ matches: true }) as MediaQueryList) as never;
		expect(getMode()).toBe("dark");

		(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
			((_query: string) =>
				({ matches: false }) as MediaQueryList) as never;
		expect(getMode()).toBe("light");
	});

	it("honours an explicit stored mode over the OS preference", () => {
		window.localStorage.setItem("rawkode-mode", "light");
		(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
			((_query: string) =>
				({ matches: true }) as MediaQueryList) as never;
		expect(getMode()).toBe("light");
	});

	it("setMode toggles the .dark class, persists, and dispatches", () => {
		setMode("dark");
		expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
			"dark",
			true,
		);
		expect(window.localStorage.getItem("rawkode-mode")).toBe("dark");
		expect(window.dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: "mode-change" }),
		);

		setMode("light");
		expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
			"dark",
			false,
		);
		expect(window.localStorage.getItem("rawkode-mode")).toBe("light");
	});

	it("toggleMode flips and returns the new value", () => {
		window.localStorage.setItem("rawkode-mode", "light");
		const next = toggleMode();
		expect(next).toBe("dark");
		expect(window.localStorage.getItem("rawkode-mode")).toBe("dark");

		const back = toggleMode();
		expect(back).toBe("light");
	});
});
