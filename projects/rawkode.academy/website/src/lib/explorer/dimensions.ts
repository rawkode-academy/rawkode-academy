/**
 * Dimension definitions for the Technology Explorer
 * Defines all available axes, their values, labels, and colors
 */

export {
	CATEGORICAL_DIMENSIONS,
	CNCF_STATUS_VALUES,
	DIMENSIONS,
	getAxisOptions,
	getDimension,
	getDimensionColor,
	getDimensionLabel,
	MATRIX_CONFIDENCE_VALUES,
	MATRIX_GROUPING_VALUES,
	MATRIX_STATUS_VALUES,
	MATRIX_TRAJECTORY_VALUES,
	ORDERED_DIMENSIONS,
	TECHNOLOGY_STATUS_VALUES,
} from "./dimension-values";
export type {
	DimensionDefinition,
	DimensionKey,
	DimensionValue,
} from "./dimension-values";
export type { TechnologyData } from "@/lib/live-content/types";

import type { TECHNOLOGY_STATUS_VALUES as STATUS } from "./dimension-values";
export type TechnologyStatus = (typeof STATUS)[number];
