/**
 * Dimension definitions for the Technology Explorer
 * Defines all available axes, their values, labels, and colors
 */

export const MATRIX_GROUPING_VALUES = [
  "plumbing",
  "platform",
  "observability",
  "security",
] as const;

export const MATRIX_STATUS_VALUES = [
  "skip",
  "watch",
  "explore",
  "learn",
  "adopt",
  "advocate",
  "graveyard",
  "guilty-pleasure",
] as const;

export const MATRIX_CONFIDENCE_VALUES = [
  "gut",
  "some-experience",
  "deep-experience",
] as const;

export const MATRIX_TRAJECTORY_VALUES = [
  "rising",
  "stable",
  "falling",
] as const;

export const CNCF_STATUS_VALUES = [
  "sandbox",
  "incubating",
  "graduated",
  "archived",
] as const;

export const TECHNOLOGY_STATUS_VALUES = [
  "alpha",
  "beta",
  "stable",
  "preview",
  "superseded",
  "deprecated",
  "abandoned",
] as const;

export type DimensionKey =
  | "matrix.grouping"
  | "matrix.status"
  | "matrix.confidence"
  | "matrix.trajectory"
  | "cncf.status"
  | "category"
  | "subcategory"
  | "status";

export interface DimensionValue {
  value: string;
  label: string;
  description?: string;
  color: string;
  darkColor?: string;
}

export interface DimensionDefinition {
  key: DimensionKey;
  label: string;
  description: string;
  values: DimensionValue[];
  /** Whether this dimension supports null/undefined values */
  nullable: boolean;
  /** Label for null values */
  nullLabel?: string;
}

// Matrix Grouping
const matrixGroupingValues: DimensionValue[] = [
  {
    value: "plumbing",
    label: "Plumbing",
    description: "The invisible infrastructure",
    color: "#6366f1", // indigo
    darkColor: "#818cf8",
  },
  {
    value: "platform",
    label: "Platform",
    description: "Building blocks for developers",
    color: "#8b5cf6", // violet
    darkColor: "#a78bfa",
  },
  {
    value: "observability",
    label: "Observability",
    description: "Understanding what's happening",
    color: "#06b6d4", // cyan
    darkColor: "#22d3ee",
  },
  {
    value: "security",
    label: "Security",
    description: "Keeping things safe",
    color: "#f59e0b", // amber
    darkColor: "#fbbf24",
  },
];

// Matrix Pipeline Status
const matrixStatusValues: DimensionValue[] = [
  {
    value: "skip",
    label: "Skip",
    description: "Just not for me",
    color: "#ef4444", // red
    darkColor: "#f87171",
  },
  {
    value: "watch",
    label: "Watch",
    description: "On my radar",
    color: "#f97316", // orange
    darkColor: "#fb923c",
  },
  {
    value: "explore",
    label: "Explore",
    description: "Worth a look",
    color: "#ca8a04", // yellow-700
    darkColor: "#facc15",
  },
  {
    value: "learn",
    label: "Learn",
    description: "Investing time",
    color: "#3b82f6", // blue
    darkColor: "#60a5fa",
  },
  {
    value: "adopt",
    label: "Adopt",
    description: "Production ready",
    color: "#22c55e", // green
    darkColor: "#4ade80",
  },
  {
    value: "advocate",
    label: "Advocate",
    description: "Championing",
    color: "#04B59C", // brand primary
    darkColor: "#85FF95",
  },
  {
    value: "graveyard",
    label: "Graveyard",
    description: "Tried, got burned, walked away",
    color: "#7f1d1d", // red-900
    darkColor: "#991b1b",
  },
  {
    value: "guilty-pleasure",
    label: "Guilty Pleasure",
    description: "Know it's 'wrong' but keep using",
    color: "#db2777", // pink-600
    darkColor: "#f472b6",
  },
];

// Matrix Confidence
const matrixConfidenceValues: DimensionValue[] = [
  {
    value: "gut",
    label: "Gut",
    description: "Intuition-based",
    color: "#f97316",
    darkColor: "#fb923c",
  },
  {
    value: "some-experience",
    label: "Some Experience",
    description: "Tried it out",
    color: "#3b82f6",
    darkColor: "#60a5fa",
  },
  {
    value: "deep-experience",
    label: "Deep Experience",
    description: "Production usage",
    color: "#22c55e",
    darkColor: "#4ade80",
  },
];

// Matrix Trajectory
const matrixTrajectoryValues: DimensionValue[] = [
  {
    value: "rising",
    label: "Rising",
    description: "Gaining momentum",
    color: "#22c55e",
    darkColor: "#4ade80",
  },
  {
    value: "stable",
    label: "Stable",
    description: "Consistent position",
    color: "#6b7280",
    darkColor: "#9ca3af",
  },
  {
    value: "falling",
    label: "Falling",
    description: "Losing momentum",
    color: "#ef4444",
    darkColor: "#f87171",
  },
];

// CNCF Status
const cncfStatusValues: DimensionValue[] = [
  {
    value: "sandbox",
    label: "Sandbox",
    description: "Early-stage CNCF project",
    color: "#f97316",
    darkColor: "#fb923c",
  },
  {
    value: "incubating",
    label: "Incubating",
    description: "Maturing CNCF project",
    color: "#3b82f6",
    darkColor: "#60a5fa",
  },
  {
    value: "graduated",
    label: "Graduated",
    description: "Mature CNCF project",
    color: "#22c55e",
    darkColor: "#4ade80",
  },
  {
    value: "archived",
    label: "Archived",
    description: "Deprecated CNCF project",
    color: "#6b7280",
    darkColor: "#9ca3af",
  },
];

// Technology Status
const techStatusValues: DimensionValue[] = [
  {
    value: "alpha",
    label: "Alpha",
    description: "Early development",
    color: "#f97316",
    darkColor: "#fb923c",
  },
  {
    value: "beta",
    label: "Beta",
    description: "Testing phase",
    color: "#eab308",
    darkColor: "#facc15",
  },
  {
    value: "stable",
    label: "Stable",
    description: "Production ready",
    color: "#22c55e",
    darkColor: "#4ade80",
  },
  {
    value: "preview",
    label: "Preview",
    description: "Preview release",
    color: "#8b5cf6",
    darkColor: "#a78bfa",
  },
  {
    value: "superseded",
    label: "Superseded",
    description: "Replaced by newer tech",
    color: "#6b7280",
    darkColor: "#9ca3af",
  },
  {
    value: "deprecated",
    label: "Deprecated",
    description: "No longer recommended",
    color: "#f59e0b",
    darkColor: "#fbbf24",
  },
  {
    value: "abandoned",
    label: "Abandoned",
    description: "No longer maintained",
    color: "#ef4444",
    darkColor: "#f87171",
  },
];

// All dimension definitions
export const DIMENSIONS: Record<DimensionKey, DimensionDefinition> = {
  "matrix.grouping": {
    key: "matrix.grouping",
    label: "Grouping",
    description: "Rawkode's mental model categories",
    values: matrixGroupingValues,
    nullable: true,
    nullLabel: "Uncategorized",
  },
  "matrix.status": {
    key: "matrix.status",
    label: "Pipeline Stage",
    description: "Where in Rawkode's adoption journey",
    values: matrixStatusValues,
    nullable: true,
    nullLabel: "Not Rated",
  },
  "matrix.confidence": {
    key: "matrix.confidence",
    label: "Confidence",
    description: "How confident in the rating",
    values: matrixConfidenceValues,
    nullable: true,
    nullLabel: "Unknown",
  },
  "matrix.trajectory": {
    key: "matrix.trajectory",
    label: "Trajectory",
    description: "Direction of momentum",
    values: matrixTrajectoryValues,
    nullable: true,
    nullLabel: "Unknown",
  },
  "cncf.status": {
    key: "cncf.status",
    label: "CNCF Status",
    description: "CNCF project maturity level",
    values: cncfStatusValues,
    nullable: true,
    nullLabel: "Not CNCF",
  },
  category: {
    key: "category",
    label: "Category",
    description: "CNCF landscape category",
    values: [], // Populated dynamically from data
    nullable: true,
    nullLabel: "Uncategorized",
  },
  subcategory: {
    key: "subcategory",
    label: "Subcategory",
    description: "CNCF landscape subcategory",
    values: [], // Populated dynamically from data
    nullable: true,
    nullLabel: "Uncategorized",
  },
  status: {
    key: "status",
    label: "Tech Status",
    description: "Technology lifecycle status",
    values: techStatusValues,
    nullable: false,
  },
};

/**
 * Get dimension definition by key
 */
export function getDimension(key: DimensionKey): DimensionDefinition {
  return DIMENSIONS[key];
}

/**
 * Get color for a dimension value
 */
export function getDimensionColor(
  dimensionKey: DimensionKey,
  value: string | null | undefined,
  isDark = false,
): string {
  if (value === null || value === undefined) {
    return isDark ? "#4b5563" : "#9ca3af"; // gray
  }

  const dimension = DIMENSIONS[dimensionKey];
  const dimValue = dimension.values.find((v) => v.value === value);

  if (!dimValue) {
    return isDark ? "#4b5563" : "#9ca3af";
  }

  return isDark ? (dimValue.darkColor ?? dimValue.color) : dimValue.color;
}

/**
 * Get label for a dimension value
 */
export function getDimensionLabel(
  dimensionKey: DimensionKey,
  value: string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return DIMENSIONS[dimensionKey].nullLabel ?? "Unknown";
  }

  const dimension = DIMENSIONS[dimensionKey];
  const dimValue = dimension.values.find((v) => v.value === value);

  return dimValue?.label ?? value;
}

/**
 * Get all available axis options for dropdowns
 */
export function getAxisOptions(): Array<{
  key: DimensionKey;
  label: string;
  description: string;
}> {
  return Object.values(DIMENSIONS).map((dim) => ({
    key: dim.key,
    label: dim.label,
    description: dim.description,
  }));
}

/**
 * Dimensions that work well as X-axis (ordered/sequential)
 */
export const ORDERED_DIMENSIONS: DimensionKey[] = [
  "matrix.status",
  "matrix.confidence",
  "matrix.trajectory",
  "cncf.status",
  "status",
];

/**
 * Dimensions that work well as Y-axis (categorical)
 */
export const CATEGORICAL_DIMENSIONS: DimensionKey[] = [
  "matrix.grouping",
  "category",
  "subcategory",
  "cncf.status",
];
