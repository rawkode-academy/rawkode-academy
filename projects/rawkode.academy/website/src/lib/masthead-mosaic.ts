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
const TITLE_ROWS = 2;
const TITLE_COLUMNS = 4;
// A long title reaches past the mosaic origin. `clearColumns` leading
// columns then stay empty on every row, so no tile sits under the title or
// against the end of the description.
const clearOfTitle = ([x, y]: Slot, clearColumns: number) =>
	x >= clearColumns && !(y < TITLE_ROWS && x < TITLE_COLUMNS);

// Advance widths of Red Hat Display ExtraBold in em, measured from the font.
// Enough to size a collection name on the server; unknown glyphs take the
// average.
// biome-ignore format: a compact table reads better than one glyph per line.
const GLYPH_EM: Record<string, number> = {
	a: 0.556, b: 0.632, c: 0.532, d: 0.632, e: 0.586, f: 0.431, g: 0.628,
	h: 0.594, i: 0.245, j: 0.245, k: 0.568, l: 0.245, m: 0.906, n: 0.594,
	o: 0.616, p: 0.632, q: 0.632, r: 0.408, s: 0.491, t: 0.425, u: 0.594,
	v: 0.58, w: 0.772, x: 0.555, y: 0.577, z: 0.5, A: 0.732, B: 0.691,
	C: 0.718, D: 0.738, E: 0.645, F: 0.639, G: 0.794, H: 0.739, I: 0.272,
	J: 0.642, K: 0.697, L: 0.628, M: 0.882, N: 0.749, O: 0.813, P: 0.681,
	Q: 0.813, R: 0.679, S: 0.632, T: 0.652, U: 0.725, V: 0.732, W: 0.944,
	X: 0.7, Y: 0.706, Z: 0.617, " ": 0.201,
};
const AVERAGE_GLYPH_EM = 0.6;
// The masthead at its widest: the title at 7.5rem with -0.05em tracking, the
// count at a fifth of that in mono, and the mosaic origin 574px (half the
// 1084px content width plus 2rem) from the title's left edge. Narrower wide
// screens scale the title down faster than the origin moves in.
const TITLE_PX = 120;
const TITLE_TRACKING_EM = -0.05;
const TITLE_MAX_PX = 768;
const COUNT_DIGIT_PX = 14.4;
const COUNT_GAP_PX = 14.4;
const ORIGIN_PX = 574;
const CELL_PX = 64;

/**
 * How many leading mosaic columns a masthead title needs kept clear so the
 * first tile starts at least one whole cell beyond the title (and its
 * count). Zero for the short collection names; Technologies needs four.
 */
export function titleClearColumns(title: string, figure?: number | string) {
	const em = [...title].reduce(
		(width, glyph) =>
			width + (GLYPH_EM[glyph] ?? AVERAGE_GLYPH_EM) + TITLE_TRACKING_EM,
		0,
	);
	// A title wider than the copy column wraps, so it never exceeds it.
	const titlePx = Math.min(em * TITLE_PX, TITLE_MAX_PX);
	const countPx =
		figure === undefined
			? 0
			: COUNT_GAP_PX + String(figure).length * COUNT_DIGIT_PX;
	const beyond = titlePx + countPx + CELL_PX - ORIGIN_PX;
	return Math.max(0, Math.min(COLUMNS - 4, Math.ceil(beyond / CELL_PX)));
}

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
	clearColumns = 0,
): MosaicTile[] {
	const unique = [...new Set(sources.filter(Boolean))].slice(0, LIMIT[shape]);
	if (unique.length === 0) return [];

	const random = seeded(`${shape}:${seed}`);
	const slots = SLOTS[shape].filter(
		(slot) =>
			clearOfTitle(slot, clearColumns) &&
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
