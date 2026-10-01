import { describe, expect, it } from "vitest";
import { layoutMosaic, type MosaicShape } from "./masthead-mosaic";

const sources = (count: number) =>
	Array.from({ length: count }, (_, index) => `/art/${index}.webp`);

const cells = (tile: { x: number; y: number; w: number; h: number }) =>
	Array.from({ length: tile.w * tile.h }, (_, index) => ({
		x: tile.x + (index % tile.w),
		y: tile.y + Math.floor(index / tile.w),
	}));

describe("layoutMosaic", () => {
	it("renders nothing without artwork", () => {
		expect(layoutMosaic([], "video", "Videos")).toEqual([]);
		expect(layoutMosaic(["", ""], "logo", "Technologies")).toEqual([]);
	});

	it("is stable for the same collection", () => {
		expect(layoutMosaic(sources(12), "video", "Videos")).toEqual(
			layoutMosaic(sources(12), "video", "Videos"),
		);
	});

	it("drops duplicate artwork", () => {
		const tiles = layoutMosaic(
			["/a.png", "/a.png", "/b.png"],
			"portrait",
			"People",
		);
		expect(tiles.map((tile) => tile.src)).toEqual(["/a.png", "/b.png"]);
	});

	for (const shape of ["video", "portrait", "logo"] as MosaicShape[]) {
		it(`keeps ${shape} tiles on the lattice, apart, and clear of the title`, () => {
			const tiles = layoutMosaic(sources(40), shape, "Collection");
			expect(tiles.length).toBeGreaterThan(0);
			const taken = new Set<string>();
			for (const tile of tiles) {
				for (const { x, y } of cells(tile)) {
					expect(x).toBeGreaterThanOrEqual(0);
					expect(y).toBeGreaterThanOrEqual(0);
					expect(y).toBeLessThan(6);
					expect(y < 2 && x < 4).toBe(false);
					expect(taken.has(`${x},${y}`)).toBe(false);
					taken.add(`${x},${y}`);
				}
			}
		});

		it(`lights only the lead ${shape} tile`, () => {
			const tiles = layoutMosaic(sources(8), shape, "Collection");
			expect(tiles[0]?.src).toBe("/art/0.webp");
			expect(tiles.filter((tile) => tile.lit)).toEqual([tiles[0]]);
		});
	}
});
