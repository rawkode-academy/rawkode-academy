/**
 * Data layer for the Technology Explorer
 * Normalizes technology data and builds indices for fast filtering/grouping
 */

import type { TechnologyData } from "@rawkodeacademy/content";
import type { DimensionKey } from "./dimensions";
import { DIMENSIONS } from "./dimensions";

/**
 * Raw technology data as received from Astro content collection
 */
export interface RawTechnology {
	id: string;
	data: TechnologyData;
}

/**
 * Normalized technology for visualization
 */
export interface NormalizedTechnology {
	id: string;
	name: string;
	icon: string | null;

	// Dimension values for filtering/grouping
	dimensions: Record<DimensionKey, string | null>;

	// Numeric metrics for sizing/coloring
	metrics: {
		videoCount: number;
		articleCount: number;
		firstUsedTimestamp: number | null;
		lastUsedTimestamp: number | null;
		cncfAcceptedTimestamp: number | null;
		cncfGraduatedTimestamp: number | null;
	};

	// Card data for detail view
	cardData: {
		website: string | null;
		why: string | null;
		spicyTake: string | null;
		makesMeFeel: string | null;
		firstUsed: string | null;
		lastUsed: string | null;
		personas: string[];
		tags: string[];
	};
}

/**
 * Index for fast lookups
 */
export interface DataIndex {
	/** All normalized technologies by ID */
	technologies: Map<string, NormalizedTechnology>;

	/** Technologies grouped by dimension value */
	byDimension: Map<DimensionKey, Map<string | null, Set<string>>>;

	/** All unique values for each dimension */
	dimensionValues: Map<DimensionKey, Set<string>>;

	/** Category -> subcategories mapping */
	categoryToSubcategories: Map<string, Set<string>>;
}

/**
 * Parse YYYY-MM date string to timestamp
 */
function parseYearMonth(dateStr: string | undefined): number | null {
	if (!dateStr) return null;
	const [year, month] = dateStr.split("-").map(Number);
	if (!year || !month) return null;
	return new Date(year, month - 1, 1).getTime();
}

/**
 * Parse ISO date string to timestamp
 */
function parseISODate(dateStr: string | undefined): number | null {
	if (!dateStr) return null;
	const timestamp = Date.parse(dateStr);
	return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Normalize a single technology
 * @param raw - Raw technology data from content collection
 * @param videoCount - Number of videos featuring this technology
 * @param articleCount - Number of articles featuring this technology
 * @param iconUrl - Pre-resolved icon URL (from Vite asset processing)
 */
export function normalizeTechnology(
	raw: RawTechnology,
	videoCount = 0,
	articleCount = 0,
	iconUrl: string | null = null,
): NormalizedTechnology {
	const { id, data } = raw;

	return {
		id,
		name: data.name,
		icon: iconUrl,

		dimensions: {
			"matrix.grouping": data.matrix?.grouping ?? null,
			"matrix.status": data.matrix?.status ?? null,
			"matrix.confidence": data.matrix?.confidence ?? null,
			"matrix.trajectory": data.matrix?.trajectory ?? null,
			"cncf.status": data.cncf?.status ?? null,
			category: data.category ?? null,
			subcategory: data.subcategory ?? null,
			status: data.status ?? "stable",
		},

		metrics: {
			videoCount,
			articleCount,
			firstUsedTimestamp: parseYearMonth(data.matrix?.firstUsed),
			lastUsedTimestamp: parseYearMonth(data.matrix?.lastUsed),
			cncfAcceptedTimestamp: parseISODate(data.cncf?.accepted),
			cncfGraduatedTimestamp: parseISODate(data.cncf?.graduated),
		},

		cardData: {
			website: data.website ?? null,
			why: data.matrix?.why ?? null,
			spicyTake: data.matrix?.spicyTake ?? null,
			makesMeFeel: data.matrix?.makesMeFeel ?? null,
			firstUsed: data.matrix?.firstUsed ?? null,
			lastUsed: data.matrix?.lastUsed ?? null,
			personas: data.cncf?.personas ?? [],
			tags: data.cncf?.tags ?? [],
		},
	};
}

/**
 * Build index from normalized technologies
 */
export function buildIndex(technologies: NormalizedTechnology[]): DataIndex {
	const techMap = new Map<string, NormalizedTechnology>();
	const byDimension = new Map<DimensionKey, Map<string | null, Set<string>>>();
	const dimensionValues = new Map<DimensionKey, Set<string>>();
	const categoryToSubcategories = new Map<string, Set<string>>();

	// Initialize dimension maps
	for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
		byDimension.set(key, new Map());
		dimensionValues.set(key, new Set());
	}

	// Index each technology
	for (const tech of technologies) {
		techMap.set(tech.id, tech);

		// Index by each dimension
		for (const [dimKey, value] of Object.entries(tech.dimensions)) {
			const key = dimKey as DimensionKey;
			const dimMap = byDimension.get(key)!;

			if (!dimMap.has(value)) {
				dimMap.set(value, new Set());
			}
			dimMap.get(value)!.add(tech.id);

			if (value !== null) {
				dimensionValues.get(key)!.add(value);
			}
		}

		// Build category -> subcategory mapping
		const category = tech.dimensions.category;
		const subcategory = tech.dimensions.subcategory;
		if (category && subcategory) {
			if (!categoryToSubcategories.has(category)) {
				categoryToSubcategories.set(category, new Set());
			}
			categoryToSubcategories.get(category)!.add(subcategory);
		}
	}

	return {
		technologies: techMap,
		byDimension,
		dimensionValues,
		categoryToSubcategories,
	};
}

/**
 * Filter technologies by multiple criteria
 */
export function filterTechnologies(
	index: DataIndex,
	filters: Partial<Record<DimensionKey, string[]>>,
	searchQuery = "",
): NormalizedTechnology[] {
	let techIds: Set<string> | null = null;

	// Apply dimension filters (intersection)
	for (const [dimKey, values] of Object.entries(filters)) {
		if (!values || values.length === 0) continue;

		const key = dimKey as DimensionKey;
		const dimMap = index.byDimension.get(key);
		if (!dimMap) continue;

		// Get all tech IDs matching any of the filter values (union within dimension)
		const matchingIds = new Set<string>();
		for (const value of values) {
			const ids = dimMap.get(value);
			if (ids) {
				for (const id of ids) {
					matchingIds.add(id);
				}
			}
		}

		// Intersect with previous results
		if (techIds === null) {
			techIds = matchingIds;
		} else {
			const currentIds = techIds as Set<string>;
			techIds = new Set([...currentIds].filter((id) => matchingIds.has(id)));
		}
	}

	// If no filters applied, start with all technologies
	if (techIds === null) {
		techIds = new Set(index.technologies.keys());
	}

	// Apply search filter
	let results = [...techIds].map((id) => index.technologies.get(id)!);

	if (searchQuery.trim()) {
		const query = searchQuery.toLowerCase().trim();
		results = results.filter(
			(tech) =>
				tech.name.toLowerCase().includes(query) ||
				tech.id.toLowerCase().includes(query) ||
				tech.cardData.tags.some((tag) => tag.toLowerCase().includes(query)),
		);
	}

	return results;
}

/**
 * Group technologies by a dimension
 */
export function groupByDimension(
	technologies: NormalizedTechnology[],
	dimension: DimensionKey,
): Map<string | null, NormalizedTechnology[]> {
	const groups = new Map<string | null, NormalizedTechnology[]>();

	for (const tech of technologies) {
		const value = tech.dimensions[dimension];
		if (!groups.has(value)) {
			groups.set(value, []);
		}
		groups.get(value)!.push(tech);
	}

	return groups;
}

/**
 * Create a 2D grid grouping for matrix visualization
 */
export function createGrid(
	technologies: NormalizedTechnology[],
	xDimension: DimensionKey,
	yDimension: DimensionKey,
): Map<string | null, Map<string | null, NormalizedTechnology[]>> {
	const grid = new Map<
		string | null,
		Map<string | null, NormalizedTechnology[]>
	>();

	for (const tech of technologies) {
		const yValue = tech.dimensions[yDimension];
		const xValue = tech.dimensions[xDimension];

		if (!grid.has(yValue)) {
			grid.set(yValue, new Map());
		}

		const row = grid.get(yValue)!;
		if (!row.has(xValue)) {
			row.set(xValue, []);
		}

		row.get(xValue)!.push(tech);
	}

	return grid;
}

/**
 * Dimensions where null values should not create a column
 * (unrated technologies simply don't appear in these views)
 */
const EXCLUDE_NULL_DIMENSIONS: DimensionKey[] = [
	"matrix.status",
	"matrix.confidence",
	"matrix.trajectory",
];

/**
 * Get ordered dimension values from a filtered set of technologies
 * This ensures axis values match the visible data
 */
export function getAxisValuesFromTechnologies(
	dimension: DimensionKey,
	technologies: NormalizedTechnology[],
): (string | null)[] {
	const definedValues = DIMENSIONS[dimension].values.map((v) => v.value);
	const excludeNull = EXCLUDE_NULL_DIMENSIONS.includes(dimension);

	// Collect actual values present in the filtered technologies
	const actualValues = new Set<string>();
	let hasNull = false;

	for (const tech of technologies) {
		const value = tech.dimensions[dimension];
		if (value === null) {
			hasNull = true;
		} else {
			actualValues.add(value);
		}
	}

	// For dimensions with predefined order, use that order
	if (definedValues.length > 0) {
		const ordered = definedValues.filter((v) => actualValues.has(v));
		if (!excludeNull && hasNull) {
			ordered.push(null as unknown as string);
		}
		return ordered;
	}

	// For dynamic dimensions (category, subcategory), sort alphabetically
	const sorted = [...actualValues].sort();
	if (!excludeNull && hasNull) {
		sorted.push(null as unknown as string);
	}
	return sorted;
}

/**
 * Prepare data for JSON serialization (Astro -> Vue)
 */
export function serializeForClient(
	technologies: NormalizedTechnology[],
): string {
	return JSON.stringify(technologies);
}

/**
 * Parse serialized data on client
 */
export function parseFromServer(json: string): NormalizedTechnology[] {
	return JSON.parse(json) as NormalizedTechnology[];
}
