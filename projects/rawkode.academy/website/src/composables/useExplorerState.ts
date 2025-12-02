/**
 * Explorer State Management Composable
 * Manages view mode, axes, filters, and selected technology
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import type { DimensionKey } from "@/lib/explorer/dimensions";
import type { ViewMode, ExplorerFilters } from "@/lib/explorer/presets";
import {
	DEFAULT_FILTERS,
	getPresetById,
	getDefaultPreset,
	type ExplorerPreset,
} from "@/lib/explorer/presets";
import {
	type NormalizedTechnology,
	buildIndex,
	filterTechnologies,
	createGrid,
	getAxisValuesFromTechnologies,
} from "@/lib/explorer/data-layer";

export interface ExplorerState {
	// View configuration
	viewMode: ViewMode;
	xAxis: DimensionKey;
	yAxis: DimensionKey;

	// Scatter-specific
	sizeBy: "videoCount" | "articleCount" | null;
	colorBy: DimensionKey | null;

	// Filters
	filters: ExplorerFilters;

	// UI state
	hoveredTechId: string | null;
	selectedTechId: string | null;
	showControls: boolean;
}

export interface UseExplorerStateReturn {
	// State refs
	viewMode: Ref<ViewMode>;
	xAxis: Ref<DimensionKey>;
	yAxis: Ref<DimensionKey>;
	sizeBy: Ref<"videoCount" | "articleCount" | null>;
	colorBy: Ref<DimensionKey | null>;
	filters: Ref<ExplorerFilters>;
	hoveredTechId: Ref<string | null>;
	selectedTechId: Ref<string | null>;
	showControls: Ref<boolean>;

	// Computed data
	filteredTechnologies: ComputedRef<NormalizedTechnology[]>;
	gridData: ComputedRef<
		Map<string | null, Map<string | null, NormalizedTechnology[]>>
	>;
	xAxisValues: ComputedRef<(string | null)[]>;
	yAxisValues: ComputedRef<(string | null)[]>;
	activePreset: ComputedRef<ExplorerPreset | null>;
	filterCount: ComputedRef<number>;

	// Technology lookups
	getTechnology: (id: string) => NormalizedTechnology | undefined;
	hoveredTech: ComputedRef<NormalizedTechnology | null>;
	selectedTech: ComputedRef<NormalizedTechnology | null>;

	// Actions
	setViewMode: (mode: ViewMode) => void;
	setXAxis: (axis: DimensionKey) => void;
	setYAxis: (axis: DimensionKey) => void;
	setSizeBy: (metric: "videoCount" | "articleCount" | null) => void;
	setColorBy: (dimension: DimensionKey | null) => void;
	setFilter: (dimension: DimensionKey, values: string[]) => void;
	toggleFilterValue: (dimension: DimensionKey, value: string) => void;
	setSearch: (query: string) => void;
	clearFilters: () => void;
	applyPreset: (presetId: string) => void;
	hoverTech: (id: string | null) => void;
	selectTech: (id: string | null) => void;
	toggleControls: () => void;

	// Serialization
	getState: () => ExplorerState;
	setState: (state: Partial<ExplorerState>) => void;
}

/**
 * Create explorer state composable
 */
export function useExplorerState(
	technologies: NormalizedTechnology[],
	initialState?: Partial<ExplorerState>,
): UseExplorerStateReturn {
	// Build index once
	const index = buildIndex(technologies);

	// Get default preset for initial values
	const defaultPreset = getDefaultPreset();

	// State refs
	const viewMode = ref<ViewMode>(
		initialState?.viewMode ?? defaultPreset.viewMode,
	);
	const xAxis = ref<DimensionKey>(initialState?.xAxis ?? defaultPreset.xAxis);
	const yAxis = ref<DimensionKey>(initialState?.yAxis ?? defaultPreset.yAxis);
	const sizeBy = ref<"videoCount" | "articleCount" | null>(
		initialState?.sizeBy ?? null,
	);
	const colorBy = ref<DimensionKey | null>(initialState?.colorBy ?? null);
	const filters = ref<ExplorerFilters>({
		...DEFAULT_FILTERS,
		...defaultPreset.filters,
		...initialState?.filters,
	});
	const hoveredTechId = ref<string | null>(initialState?.hoveredTechId ?? null);
	const selectedTechId = ref<string | null>(
		initialState?.selectedTechId ?? null,
	);
	const showControls = ref<boolean>(initialState?.showControls ?? true);

	// Computed: filtered technologies
	const filteredTechnologies = computed(() => {
		const dimensionFilters: Partial<Record<DimensionKey, string[]>> = {
			"matrix.grouping": filters.value["matrix.grouping"],
			"matrix.status": filters.value["matrix.status"],
			"matrix.confidence": filters.value["matrix.confidence"],
			"matrix.trajectory": filters.value["matrix.trajectory"],
			"cncf.status": filters.value["cncf.status"],
			category: filters.value.category,
			subcategory: filters.value.subcategory,
			status: filters.value.status,
		};

		return filterTechnologies(index, dimensionFilters, filters.value.search);
	});

	// Computed: grid data for matrix view
	const gridData = computed(() => {
		return createGrid(filteredTechnologies.value, xAxis.value, yAxis.value);
	});

	// Computed: ordered axis values (from filtered data)
	const xAxisValues = computed(() => {
		return getAxisValuesFromTechnologies(
			xAxis.value,
			filteredTechnologies.value,
		);
	});

	const yAxisValues = computed(() => {
		return getAxisValuesFromTechnologies(
			yAxis.value,
			filteredTechnologies.value,
		);
	});

	// Computed: active preset (if current state matches a preset)
	const activePreset = computed(() => {
		// Simple check: does current config match any preset?
		const presets = [
			"pipeline",
			"cncf-by-grouping",
			"confidence-view",
			"radar",
			"my-journey",
			"cncf-timeline",
			"cncf-maturity",
			"by-category",
			"pipeline-flow",
		];

		for (const presetId of presets) {
			const preset = getPresetById(presetId);
			if (!preset) continue;

			if (
				preset.viewMode === viewMode.value &&
				preset.xAxis === xAxis.value &&
				preset.yAxis === yAxis.value
			) {
				return preset;
			}
		}

		return null;
	});

	// Computed: filter count
	const filterCount = computed(() => {
		let count = 0;
		for (const key of Object.keys(filters.value) as Array<
			keyof ExplorerFilters
		>) {
			if (key === "search") {
				if (filters.value.search.trim()) count++;
			} else {
				count += filters.value[key].length;
			}
		}
		return count;
	});

	// Technology lookup
	const getTechnology = (id: string): NormalizedTechnology | undefined => {
		return index.technologies.get(id);
	};

	const hoveredTech = computed(() => {
		if (!hoveredTechId.value) return null;
		return getTechnology(hoveredTechId.value) ?? null;
	});

	const selectedTech = computed(() => {
		if (!selectedTechId.value) return null;
		return getTechnology(selectedTechId.value) ?? null;
	});

	// Actions
	const setViewMode = (mode: ViewMode) => {
		viewMode.value = mode;
	};

	const setXAxis = (axis: DimensionKey) => {
		xAxis.value = axis;
	};

	const setYAxis = (axis: DimensionKey) => {
		yAxis.value = axis;
	};

	const setSizeBy = (metric: "videoCount" | "articleCount" | null) => {
		sizeBy.value = metric;
	};

	const setColorBy = (dimension: DimensionKey | null) => {
		colorBy.value = dimension;
	};

	const setFilter = (dimension: DimensionKey, values: string[]) => {
		filters.value = {
			...filters.value,
			[dimension]: values,
		};
	};

	const toggleFilterValue = (dimension: DimensionKey, value: string) => {
		const currentValues = filters.value[dimension] as string[];
		const index = currentValues.indexOf(value);

		if (index === -1) {
			filters.value = {
				...filters.value,
				[dimension]: [...currentValues, value],
			};
		} else {
			filters.value = {
				...filters.value,
				[dimension]: currentValues.filter((v) => v !== value),
			};
		}
	};

	const setSearch = (query: string) => {
		filters.value = {
			...filters.value,
			search: query,
		};
	};

	const clearFilters = () => {
		filters.value = { ...DEFAULT_FILTERS };
	};

	const applyPreset = (presetId: string) => {
		const preset = getPresetById(presetId);
		if (!preset) return;

		viewMode.value = preset.viewMode;
		xAxis.value = preset.xAxis;
		yAxis.value = preset.yAxis;
		sizeBy.value = (preset.sizeBy as "videoCount" | "articleCount") ?? null;
		colorBy.value = preset.colorBy ?? null;

		if (preset.filters) {
			filters.value = {
				...DEFAULT_FILTERS,
				...preset.filters,
			};
		} else {
			filters.value = { ...DEFAULT_FILTERS };
		}
	};

	const hoverTech = (id: string | null) => {
		hoveredTechId.value = id;
	};

	const selectTech = (id: string | null) => {
		selectedTechId.value = id;
	};

	const toggleControls = () => {
		showControls.value = !showControls.value;
	};

	// Serialization
	const getState = (): ExplorerState => ({
		viewMode: viewMode.value,
		xAxis: xAxis.value,
		yAxis: yAxis.value,
		sizeBy: sizeBy.value,
		colorBy: colorBy.value,
		filters: { ...filters.value },
		hoveredTechId: hoveredTechId.value,
		selectedTechId: selectedTechId.value,
		showControls: showControls.value,
	});

	const setState = (state: Partial<ExplorerState>) => {
		if (state.viewMode !== undefined) viewMode.value = state.viewMode;
		if (state.xAxis !== undefined) xAxis.value = state.xAxis;
		if (state.yAxis !== undefined) yAxis.value = state.yAxis;
		if (state.sizeBy !== undefined) sizeBy.value = state.sizeBy;
		if (state.colorBy !== undefined) colorBy.value = state.colorBy;
		if (state.filters !== undefined)
			filters.value = { ...DEFAULT_FILTERS, ...state.filters };
		if (state.hoveredTechId !== undefined)
			hoveredTechId.value = state.hoveredTechId;
		if (state.selectedTechId !== undefined)
			selectedTechId.value = state.selectedTechId;
		if (state.showControls !== undefined)
			showControls.value = state.showControls;
	};

	return {
		// State refs
		viewMode,
		xAxis,
		yAxis,
		sizeBy,
		colorBy,
		filters,
		hoveredTechId,
		selectedTechId,
		showControls,

		// Computed data
		filteredTechnologies,
		gridData,
		xAxisValues,
		yAxisValues,
		activePreset,
		filterCount,

		// Technology lookups
		getTechnology,
		hoveredTech,
		selectedTech,

		// Actions
		setViewMode,
		setXAxis,
		setYAxis,
		setSizeBy,
		setColorBy,
		setFilter,
		toggleFilterValue,
		setSearch,
		clearFilters,
		applyPreset,
		hoverTech,
		selectTech,
		toggleControls,

		// Serialization
		getState,
		setState,
	};
}
