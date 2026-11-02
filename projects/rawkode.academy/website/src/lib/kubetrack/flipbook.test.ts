import { afterEach, describe, expect, it } from "vitest";
import {
	clampIndex,
	indexFromHash,
	nextIndex,
	prevIndex,
	readViewMode,
	VIEW_MODE_KEY,
	writeViewMode,
} from "./flipbook";

describe("card index", () => {
	it("clamps into range", () => {
		expect(clampIndex(-3, 65)).toBe(0);
		expect(clampIndex(12, 65)).toBe(12);
		expect(clampIndex(99, 65)).toBe(64);
		expect(clampIndex(2.7, 65)).toBe(2);
		expect(clampIndex(Number.NaN, 65)).toBe(0);
		expect(clampIndex(5, 0)).toBe(0);
	});

	it("turns pages without wrapping", () => {
		expect(nextIndex(0, 3)).toBe(1);
		expect(nextIndex(2, 3)).toBe(2);
		expect(prevIndex(2, 3)).toBe(1);
		expect(prevIndex(0, 3)).toBe(0);
	});
});

describe("indexFromHash", () => {
	const ids = ["kep-1710", "kep-4639", "kep-5000"];

	it("finds the card a hash points at", () => {
		expect(indexFromHash("#kep-4639", ids)).toBe(1);
		expect(indexFromHash("kep-5000", ids)).toBe(2);
		expect(indexFromHash("#kep%2D1710", ids)).toBe(0);
	});

	it("returns null for unknown, empty or malformed hashes", () => {
		expect(indexFromHash("#quiz", ids)).toBeNull();
		expect(indexFromHash("", ids)).toBeNull();
		expect(indexFromHash("#", ids)).toBeNull();
		expect(indexFromHash(undefined, ids)).toBeNull();
		expect(indexFromHash("#%E0%A4%A", ids)).toBeNull();
	});
});

describe("view mode", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("defaults to paged and round-trips through localStorage", () => {
		expect(readViewMode()).toBe("paged");
		writeViewMode("all");
		expect(localStorage.getItem(VIEW_MODE_KEY)).toBe("all");
		expect(readViewMode()).toBe("all");
		writeViewMode("paged");
		expect(readViewMode()).toBe("paged");
	});

	it("ignores unknown stored values", () => {
		localStorage.setItem(VIEW_MODE_KEY, "grid");
		expect(readViewMode()).toBe("paged");
	});

	it("survives storage that throws", () => {
		const broken = {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		} as unknown as Storage;
		expect(readViewMode(broken)).toBe("paged");
		expect(() => writeViewMode("all", broken)).not.toThrow();
	});
});
