/**
 * Preset configurations for the Technology Explorer
 * Quick-access views for common exploration patterns
 */

import type { DimensionKey } from "./dimensions";

export type ViewMode = "grid" | "scatter" | "timeline" | "treemap" | "sankey";

export interface ExplorerPreset {
	id: string;
	name: string;
	description: string;
	icon: string;
	viewMode: ViewMode;
	xAxis: DimensionKey;
	yAxis: DimensionKey;
	sizeBy?: DimensionKey | "videoCount" | "articleCount" | null;
	colorBy?: DimensionKey | null;
	filters?: Partial<ExplorerFilters>;
	/** Which phase this preset is available in (for progressive rollout) */
	phase: 1 | 2 | 3;
}

export interface ExplorerFilters {
	"matrix.grouping": string[];
	"matrix.status": string[];
	"matrix.confidence": string[];
	"matrix.trajectory": string[];
	"cncf.status": string[];
	category: string[];
	subcategory: string[];
	status: string[];
	search: string;
}

export const DEFAULT_FILTERS: ExplorerFilters = {
	"matrix.grouping": [],
	"matrix.status": [],
	"matrix.confidence": [],
	"matrix.trajectory": [],
	"cncf.status": [],
	category: [],
	subcategory: [],
	status: [],
	search: "",
};

export const EXPLORER_PRESETS: ExplorerPreset[] = [
	// Phase 1 - Grid view presets
	{
		id: "pipeline",
		name: "Pipeline",
		description: "Rawkode's adoption journey by category",
		icon: "🚀",
		viewMode: "grid",
		xAxis: "matrix.status",
		yAxis: "category",
		filters: {
			"matrix.status": [
				"skip",
				"watch",
				"explore",
				"learn",
				"adopt",
				"advocate",
			],
		},
		phase: 1,
	},
	{
		id: "cncf-maturity-grid",
		name: "CNCF Maturity",
		description: "CNCF maturity levels by category",
		icon: "☁️",
		viewMode: "grid",
		xAxis: "cncf.status",
		yAxis: "category",
		filters: {
			"cncf.status": ["sandbox", "incubating", "graduated"],
		},
		phase: 1,
	},
	// Phase 2 - Scatter and Timeline presets
	{
		id: "radar",
		name: "Tech Radar",
		description: "Status vs trajectory, sized by content",
		icon: "📡",
		viewMode: "scatter",
		xAxis: "matrix.status",
		yAxis: "matrix.trajectory",
		sizeBy: "videoCount",
		colorBy: "category",
		phase: 2,
	},
	{
		id: "my-journey",
		name: "My Journey",
		description: "When I started using each technology",
		icon: "🛤️",
		viewMode: "timeline",
		xAxis: "matrix.status", // Will use firstUsed for timeline
		yAxis: "category",
		phase: 2,
	},
	{
		id: "cncf-timeline",
		name: "CNCF Timeline",
		description: "When projects graduated through CNCF",
		icon: "📅",
		viewMode: "timeline",
		xAxis: "cncf.status", // Will use cncf.accepted/graduated dates
		yAxis: "category",
		filters: {
			"cncf.status": ["sandbox", "incubating", "graduated"],
		},
		phase: 2,
	},

	// Phase 3 - Treemap and Sankey presets
	{
		id: "cncf-maturity",
		name: "CNCF Maturity",
		description: "CNCF landscape hierarchy",
		icon: "🏛️",
		viewMode: "treemap",
		xAxis: "cncf.status",
		yAxis: "category",
		phase: 3,
	},
	{
		id: "by-category",
		name: "By Category",
		description: "Category and subcategory drill-down",
		icon: "📂",
		viewMode: "treemap",
		xAxis: "category",
		yAxis: "subcategory",
		phase: 3,
	},
	{
		id: "pipeline-flow",
		name: "Pipeline Flow",
		description: "How technologies flow through stages",
		icon: "🌊",
		viewMode: "sankey",
		xAxis: "category",
		yAxis: "matrix.status",
		phase: 3,
	},
];

/**
 * Get presets available for a given phase
 */
export function getPresetsForPhase(phase: 1 | 2 | 3): ExplorerPreset[] {
	return EXPLORER_PRESETS.filter((p) => p.phase <= phase);
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): ExplorerPreset | undefined {
	return EXPLORER_PRESETS.find((p) => p.id === id);
}

/**
 * Get default preset
 */
export function getDefaultPreset(): ExplorerPreset {
	return EXPLORER_PRESETS[0]!;
}

/**
 * Get presets by view mode
 */
export function getPresetsByViewMode(viewMode: ViewMode): ExplorerPreset[] {
	return EXPLORER_PRESETS.filter((p) => p.viewMode === viewMode);
}

/**
 * Available view modes with metadata
 */
export const VIEW_MODES: Array<{
	id: ViewMode;
	name: string;
	description: string;
	icon: string;
	phase: 1 | 2 | 3;
}> = [
	{
		id: "grid",
		name: "Grid",
		description: "Matrix layout with rows and columns",
		icon: "▦",
		phase: 1,
	},
	{
		id: "scatter",
		name: "Scatter",
		description: "Position, size, and color by dimensions",
		icon: "⊚",
		phase: 2,
	},
	{
		id: "timeline",
		name: "Timeline",
		description: "Technologies over time",
		icon: "━",
		phase: 2,
	},
	{
		id: "treemap",
		name: "Treemap",
		description: "Hierarchical category view",
		icon: "▤",
		phase: 3,
	},
	{
		id: "sankey",
		name: "Sankey",
		description: "Flow between categories",
		icon: "⥤",
		phase: 3,
	},
];

/**
 * Get available view modes for a phase
 */
export function getViewModesForPhase(
	phase: 1 | 2 | 3,
): Array<(typeof VIEW_MODES)[number]> {
	return VIEW_MODES.filter((v) => v.phase <= phase);
}
