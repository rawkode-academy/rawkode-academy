/**
 * Theme-aware color utilities for the Technology Explorer
 * Works with the existing theme system (rawkode-green, rawkode-blue, etc.)
 */

import { getDimensionColor, type DimensionKey } from "./dimensions";

/**
 * Check if dark mode is active
 */
export function isDarkMode(): boolean {
	if (typeof window === "undefined") return false;
	return document.documentElement.classList.contains("dark");
}

/**
 * Get CSS variable value
 */
export function getCSSVar(name: string): string {
	if (typeof window === "undefined") return "";
	return getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
}

/**
 * Get brand primary color as hex
 */
export function getBrandPrimary(): string {
	const rgb = getCSSVar("--brand-primary");
	if (!rgb) return "#04B59C";
	// Convert "4, 181, 156" to hex
	const [r, g, b] = rgb.split(",").map((n) => Number.parseInt(n.trim(), 10));
	if (r === undefined || g === undefined || b === undefined) return "#04B59C";
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Get brand secondary color as hex
 */
export function getBrandSecondary(): string {
	const rgb = getCSSVar("--brand-secondary");
	if (!rgb) return "#85FF95";
	const [r, g, b] = rgb.split(",").map((n) => Number.parseInt(n.trim(), 10));
	if (r === undefined || g === undefined || b === undefined) return "#85FF95";
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Color scale for numeric values (e.g., video count)
 */
export function getNumericColorScale(
	min: number,
	max: number,
): (value: number) => string {
	const dark = isDarkMode();
	const lowColor = dark ? "#374151" : "#e5e7eb"; // gray-700 / gray-200
	const highColor = getBrandPrimary();

	return (value: number) => {
		if (max === min) return highColor;
		const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
		return interpolateColor(lowColor, highColor, t);
	};
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, t: number): string {
	const r1 = Number.parseInt(color1.slice(1, 3), 16);
	const g1 = Number.parseInt(color1.slice(3, 5), 16);
	const b1 = Number.parseInt(color1.slice(5, 7), 16);

	const r2 = Number.parseInt(color2.slice(1, 3), 16);
	const g2 = Number.parseInt(color2.slice(3, 5), 16);
	const b2 = Number.parseInt(color2.slice(5, 7), 16);

	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);

	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Get color for a dimension value (wrapper around dimensions.ts)
 */
export function getColor(
	dimension: DimensionKey,
	value: string | null | undefined,
): string {
	return getDimensionColor(dimension, value, isDarkMode());
}

/**
 * Pipeline stage colors (ordered from skip to advocate)
 */
export const PIPELINE_COLORS = {
	skip: { light: "#ef4444", dark: "#f87171" },
	watch: { light: "#f97316", dark: "#fb923c" },
	explore: { light: "#ca8a04", dark: "#facc15" },
	learn: { light: "#3b82f6", dark: "#60a5fa" },
	adopt: { light: "#22c55e", dark: "#4ade80" },
	advocate: { light: "#04B59C", dark: "#85FF95" },
} as const;

/**
 * Get pipeline color
 */
export function getPipelineColor(stage: keyof typeof PIPELINE_COLORS): string {
	const colors = PIPELINE_COLORS[stage];
	return isDarkMode() ? colors.dark : colors.light;
}

/**
 * Generate a categorical color palette
 */
export function getCategoricalPalette(count: number): string[] {
	const baseColors = [
		"#6366f1", // indigo
		"#8b5cf6", // violet
		"#ec4899", // pink
		"#ef4444", // red
		"#f97316", // orange
		"#eab308", // yellow
		"#22c55e", // green
		"#06b6d4", // cyan
		"#3b82f6", // blue
		"#a855f7", // purple
	];

	if (count <= baseColors.length) {
		return baseColors.slice(0, count);
	}

	// If we need more colors, interpolate between base colors
	const palette: string[] = [];
	for (let i = 0; i < count; i++) {
		const t = i / count;
		const idx = Math.floor(t * (baseColors.length - 1));
		const localT = (t * (baseColors.length - 1)) % 1;
		const color1 = baseColors[idx]!;
		const color2 = baseColors[Math.min(idx + 1, baseColors.length - 1)]!;
		palette.push(interpolateColor(color1, color2, localT));
	}

	return palette;
}

/**
 * Surface colors for backgrounds
 */
export function getSurfaceColors() {
	const dark = isDarkMode();
	return {
		background: dark ? "#0d1117" : "#ffffff",
		card: dark ? "#161b22" : "#ffffff",
		cardMuted: dark ? "#21262d" : "#f6f8fa",
		border: dark ? "#30363d" : "#e5e7eb",
	};
}

/**
 * Text colors
 */
export function getTextColors() {
	const dark = isDarkMode();
	return {
		primary: dark ? "#e6edf3" : "#1f2937",
		secondary: dark ? "#8b949e" : "#4b5563",
		muted: dark ? "#6e7681" : "#9ca3af",
	};
}
