/**
 * URL State Composable
 * Bidirectional sync between explorer state and URL parameters
 * Uses short parameter keys for compact, shareable URLs
 */

import { watch, onMounted, onUnmounted } from "vue";
import type { ExplorerState, UseExplorerStateReturn } from "./useExplorerState";
import type { DimensionKey } from "@/lib/explorer/dimensions";
import type { ViewMode, ExplorerFilters } from "@/lib/explorer/presets";
import { DEFAULT_FILTERS } from "@/lib/explorer/presets";

// Short parameter keys for compact URLs
const PARAM_MAP = {
	viewMode: "v",
	xAxis: "x",
	yAxis: "y",
	sizeBy: "s",
	colorBy: "c",
	"filters.matrix.grouping": "fg",
	"filters.matrix.status": "fs",
	"filters.matrix.confidence": "fc",
	"filters.matrix.trajectory": "ft",
	"filters.cncf.status": "cn",
	"filters.category": "cat",
	"filters.subcategory": "sub",
	"filters.status": "st",
	"filters.search": "q",
	preset: "p",
} as const;

// View mode short codes
const VIEW_MODE_MAP: Record<ViewMode, string> = {
	grid: "g",
	scatter: "s",
	timeline: "t",
	treemap: "m",
	sankey: "k",
};

const REVERSE_VIEW_MODE_MAP = Object.fromEntries(
	Object.entries(VIEW_MODE_MAP).map(([k, v]) => [v, k]),
) as Record<string, ViewMode>;

// Dimension short codes
const DIMENSION_MAP: Record<DimensionKey, string> = {
	"matrix.grouping": "mg",
	"matrix.status": "ms",
	"matrix.confidence": "mc",
	"matrix.trajectory": "mt",
	"cncf.status": "cs",
	category: "ca",
	subcategory: "sc",
	status: "ts",
};

const REVERSE_DIMENSION_MAP = Object.fromEntries(
	Object.entries(DIMENSION_MAP).map(([k, v]) => [v, k]),
) as Record<string, DimensionKey>;

/**
 * Encode state to URL search params
 */
export function encodeStateToUrl(state: Partial<ExplorerState>): string {
	const params = new URLSearchParams();

	// View mode
	if (state.viewMode) {
		params.set(
			PARAM_MAP.viewMode,
			VIEW_MODE_MAP[state.viewMode] || state.viewMode,
		);
	}

	// Axes
	if (state.xAxis) {
		params.set(PARAM_MAP.xAxis, DIMENSION_MAP[state.xAxis] || state.xAxis);
	}
	if (state.yAxis) {
		params.set(PARAM_MAP.yAxis, DIMENSION_MAP[state.yAxis] || state.yAxis);
	}

	// Scatter options
	if (state.sizeBy) {
		params.set(PARAM_MAP.sizeBy, state.sizeBy === "videoCount" ? "vc" : "ac");
	}
	if (state.colorBy) {
		params.set(
			PARAM_MAP.colorBy,
			DIMENSION_MAP[state.colorBy] || state.colorBy,
		);
	}

	// Filters
	if (state.filters) {
		const f = state.filters;

		if (f["matrix.grouping"]?.length) {
			params.set(
				PARAM_MAP["filters.matrix.grouping"],
				f["matrix.grouping"].join(","),
			);
		}
		if (f["matrix.status"]?.length) {
			params.set(
				PARAM_MAP["filters.matrix.status"],
				f["matrix.status"].join(","),
			);
		}
		if (f["matrix.confidence"]?.length) {
			params.set(
				PARAM_MAP["filters.matrix.confidence"],
				f["matrix.confidence"].join(","),
			);
		}
		if (f["matrix.trajectory"]?.length) {
			params.set(
				PARAM_MAP["filters.matrix.trajectory"],
				f["matrix.trajectory"].join(","),
			);
		}
		if (f["cncf.status"]?.length) {
			params.set(PARAM_MAP["filters.cncf.status"], f["cncf.status"].join(","));
		}
		if (f.category?.length) {
			params.set(PARAM_MAP["filters.category"], f.category.join(","));
		}
		if (f.subcategory?.length) {
			params.set(PARAM_MAP["filters.subcategory"], f.subcategory.join(","));
		}
		if (f.status?.length) {
			params.set(PARAM_MAP["filters.status"], f.status.join(","));
		}
		if (f.search?.trim()) {
			params.set(PARAM_MAP["filters.search"], f.search.trim());
		}
	}

	return params.toString();
}

/**
 * Decode URL search params to state
 */
export function decodeUrlToState(search: string): Partial<ExplorerState> {
	const params = new URLSearchParams(search);
	const state: Partial<ExplorerState> = {};

	// View mode
	const viewModeParam = params.get(PARAM_MAP.viewMode);
	if (viewModeParam) {
		state.viewMode =
			REVERSE_VIEW_MODE_MAP[viewModeParam] || (viewModeParam as ViewMode);
	}

	// X Axis
	const xAxisParam = params.get(PARAM_MAP.xAxis);
	if (xAxisParam) {
		state.xAxis =
			REVERSE_DIMENSION_MAP[xAxisParam] || (xAxisParam as DimensionKey);
	}

	// Y Axis
	const yAxisParam = params.get(PARAM_MAP.yAxis);
	if (yAxisParam) {
		state.yAxis =
			REVERSE_DIMENSION_MAP[yAxisParam] || (yAxisParam as DimensionKey);
	}

	// Size by
	const sizeByParam = params.get(PARAM_MAP.sizeBy);
	if (sizeByParam) {
		state.sizeBy =
			sizeByParam === "vc"
				? "videoCount"
				: sizeByParam === "ac"
					? "articleCount"
					: null;
	}

	// Color by
	const colorByParam = params.get(PARAM_MAP.colorBy);
	if (colorByParam) {
		state.colorBy =
			REVERSE_DIMENSION_MAP[colorByParam] || (colorByParam as DimensionKey);
	}

	// Filters
	const filters: ExplorerFilters = { ...DEFAULT_FILTERS };

	const fgParam = params.get(PARAM_MAP["filters.matrix.grouping"]);
	if (fgParam) filters["matrix.grouping"] = fgParam.split(",").filter(Boolean);

	const fsParam = params.get(PARAM_MAP["filters.matrix.status"]);
	if (fsParam) filters["matrix.status"] = fsParam.split(",").filter(Boolean);

	const fcParam = params.get(PARAM_MAP["filters.matrix.confidence"]);
	if (fcParam)
		filters["matrix.confidence"] = fcParam.split(",").filter(Boolean);

	const ftParam = params.get(PARAM_MAP["filters.matrix.trajectory"]);
	if (ftParam)
		filters["matrix.trajectory"] = ftParam.split(",").filter(Boolean);

	const cnParam = params.get(PARAM_MAP["filters.cncf.status"]);
	if (cnParam) filters["cncf.status"] = cnParam.split(",").filter(Boolean);

	const catParam = params.get(PARAM_MAP["filters.category"]);
	if (catParam) filters.category = catParam.split(",").filter(Boolean);

	const subParam = params.get(PARAM_MAP["filters.subcategory"]);
	if (subParam) filters.subcategory = subParam.split(",").filter(Boolean);

	const stParam = params.get(PARAM_MAP["filters.status"]);
	if (stParam) filters.status = stParam.split(",").filter(Boolean);

	const qParam = params.get(PARAM_MAP["filters.search"]);
	if (qParam) filters.search = qParam;

	state.filters = filters;

	return state;
}

/**
 * Get shareable URL for current state
 */
export function getShareableUrl(state: ExplorerState): string {
	const encoded = encodeStateToUrl(state);
	const baseUrl =
		typeof window !== "undefined"
			? window.location.origin + window.location.pathname
			: "";
	return encoded ? `${baseUrl}?${encoded}` : baseUrl;
}

/**
 * Hook to sync explorer state with URL
 */
export function useUrlState(explorer: UseExplorerStateReturn): {
	initFromUrl: () => void;
	updateUrl: () => void;
	getShareUrl: () => string;
	copyShareUrl: () => Promise<boolean>;
} {
	let isUpdatingFromUrl = false;

	/**
	 * Initialize state from URL on mount
	 */
	const initFromUrl = () => {
		if (typeof window === "undefined") return;

		const search = window.location.search;
		if (!search) return;

		isUpdatingFromUrl = true;
		const state = decodeUrlToState(search);
		explorer.setState(state);
		isUpdatingFromUrl = false;
	};

	/**
	 * Update URL from current state
	 */
	const updateUrl = () => {
		if (typeof window === "undefined") return;
		if (isUpdatingFromUrl) return;

		const state = explorer.getState();
		const encoded = encodeStateToUrl(state);
		const newUrl = encoded
			? `${window.location.pathname}?${encoded}`
			: window.location.pathname;

		window.history.replaceState({}, "", newUrl);
	};

	/**
	 * Get shareable URL
	 */
	const getShareUrl = (): string => {
		const state = explorer.getState();
		return getShareableUrl(state);
	};

	/**
	 * Copy share URL to clipboard
	 */
	const copyShareUrl = async (): Promise<boolean> => {
		const url = getShareUrl();
		try {
			await navigator.clipboard.writeText(url);
			return true;
		} catch {
			return false;
		}
	};

	// Watch for state changes and update URL
	watch(
		[
			explorer.viewMode,
			explorer.xAxis,
			explorer.yAxis,
			explorer.sizeBy,
			explorer.colorBy,
			explorer.filters,
		],
		() => {
			if (!isUpdatingFromUrl) {
				updateUrl();
			}
		},
		{ deep: true },
	);

	// Handle browser back/forward
	const handlePopState = () => {
		initFromUrl();
	};

	onMounted(() => {
		if (typeof window !== "undefined") {
			window.addEventListener("popstate", handlePopState);
		}
	});

	onUnmounted(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("popstate", handlePopState);
		}
	});

	return {
		initFromUrl,
		updateUrl,
		getShareUrl,
		copyShareUrl,
	};
}
