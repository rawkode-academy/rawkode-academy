/**
 * Places a collection's artwork onto the masthead's 4rem system grid.
 *
 * Coordinates are whole grid cells measured from the mosaic origin (one cell
 * right of the page's centre line). Each kind of artwork has a set of slots
 * on the lattice: stills form a bricked wall of screens, portraits a
 * staggered wall of squares, logos single cells. The collection name seeds
 * which slots stay empty, so a page renders the same composition on every
 * request, and the first item (the newest, or the one the page is about)
 * always lands in the most legible slot.
 */
export type MosaicShape = "video" | "portrait" | "logo";

export interface MosaicTile {
	src: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** Order the tile is scheduled in, used to stagger its entrance. */
	order: number;
	lit: boolean;
}

type Slot = [x: number, y: number, w: number, h: number];

const COLUMNS = 14;
const ROWS = 6;
// The first two rows of the first four columns sit beside the title.
const clearOfTitle = ([x, y]: Slot) => !(y < 2 && x < 4);

const SLOTS: Record<MosaicShape, Slot[]> = {
	// A bricked wall of 3×2 screens, each band offset from the last.
	video: [0, 2, 4].flatMap((y, band) =>
		Array.from({ length: 6 }, (_, index) => {
			const x = index * 3 + (band === 1 ? 2 : 1);
			return [x, y, 3, 2] as Slot;
		}),
	),
	// Columns of 2×2 portraits, alternate columns dropped by one cell.
	portrait: Array.from(
		{ length: COLUMNS / 2 },
		(_, column) => column * 2,
	).flatMap((x) => {
		const offset = (x / 2) % 2;
		return [offset, offset + 2, offset + 4].map((y) => [x, y, 2, 2] as Slot);
	}),
	logo: Array.from(
		{ length: COLUMNS * ROWS },
		(_, cell) => [cell % COLUMNS, Math.floor(cell / COLUMNS), 1, 1] as Slot,
	),
};

// The most legible slot for the lead tile: clear of the title and the fade.
const LEAD: Record<MosaicShape, [number, number]> = {
	video: [5, 2],
	portrait: [6, 0],
	logo: [6, 2],
};

const LIMIT: Record<MosaicShape, number> = {
	video: 12,
	portrait: 16,
	logo: 34,
};

const seeded = (key: string) => {
	let state = 2166136261;
	for (const char of key)
		state = Math.imul(state ^ char.charCodeAt(0), 16777619);
	return () => {
		state = Math.imul(state ^ (state >>> 15), 2246822507);
		state = Math.imul(state ^ (state >>> 13), 3266489909);
		state ^= state >>> 16;
		return (state >>> 0) / 4294967296;
	};
};

export function layoutMosaic(
	sources: readonly string[],
	shape: MosaicShape,
	seed: string,
): MosaicTile[] {
	const unique = [...new Set(sources.filter(Boolean))].slice(0, LIMIT[shape]);
	if (unique.length === 0) return [];

	const random = seeded(`${shape}:${seed}`);
	const slots = SLOTS[shape].filter(
		(slot) =>
			clearOfTitle(slot) &&
			slot[0] + slot[2] <= COLUMNS &&
			slot[1] + slot[3] <= ROWS,
	);
	const [leadX, leadY] = LEAD[shape];
	const lead = slots.find(([x, y]) => x === leadX && y === leadY);
	// Earlier slots (towards the title and the top) are favoured so a small
	// collection still reads as a wall rather than scattered frames.
	const ranked = slots
		.filter((slot) => slot !== lead)
		.map((slot) => ({ slot, rank: slot[0] + slot[1] * 0.75 + random() * 7 }))
		.sort((a, b) => a.rank - b.rank)
		.map(({ slot }) => slot);
	const chosen = [...(lead ? [lead] : []), ...ranked].slice(0, unique.length);

	const tiles: MosaicTile[] = chosen.flatMap(([x, y, w, h], index) => {
		const src = unique[index];
		return src ? [{ src, x, y, w, h, order: 0, lit: index === 0 }] : [];
	});
	// Stagger the entrance as a sweep from the top left of the lattice.
	const sweep = [...tiles].sort((a, b) => a.x + a.y * 1.5 - (b.x + b.y * 1.5));
	for (const [order, tile] of sweep.entries()) tile.order = order;
	return tiles;
}
