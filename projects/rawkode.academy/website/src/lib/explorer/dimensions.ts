/**
 * Dimension definitions for the Technology Explorer
 * Defines all available axes, their values, labels, and colors
 *
 * Note: These are now re-exported from @rawkodeacademy/content
 * to ensure a single source of truth.
 */

export {
	DIMENSIONS,
	getDimension,
	getDimensionColor,
	getDimensionLabel,
	getAxisOptions,
	ORDERED_DIMENSIONS,
	CATEGORICAL_DIMENSIONS,
	MATRIX_GROUPING_VALUES,
	MATRIX_STATUS_VALUES,
	MATRIX_CONFIDENCE_VALUES,
	MATRIX_TRAJECTORY_VALUES,
	CNCF_STATUS_VALUES,
	TECHNOLOGY_STATUS_VALUES,
} from "@rawkodeacademy/content";

export type {
	DimensionKey,
	DimensionValue,
	DimensionDefinition,
	TechnologyData,
	TechnologyStatus,
} from "@rawkodeacademy/content";
