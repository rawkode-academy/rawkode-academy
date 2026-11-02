import { describe, expect, it } from "vitest";
import {
	canonicalVersion,
	groupByStage,
	STAGE_ORDER,
	stageCounts,
	stageGlyph,
	stageLabel,
} from "./version";

describe("canonicalVersion", () => {
	it.each([
		["1.37", "1.37"],
		["v1.37", "1.37"],
		["1.37.0", "1.37"],
		["v1.37.2", "1.37"],
		["01.037", "1.37"],
	])("normalises %s to %s", (raw, expected) => {
		expect(canonicalVersion(raw)).toBe(expected);
	});

	it.each([
		"",
		"1",
		"1.37.0.1",
		"latest",
		"1.x",
		"V1.37",
		"1.37-rc.1",
		"../1.37",
	])("rejects %s", (raw) => {
		expect(canonicalVersion(raw)).toBeNull();
	});

	it("handles missing input", () => {
		expect(canonicalVersion(undefined)).toBeNull();
		expect(canonicalVersion(null)).toBeNull();
	});
});

describe("stages", () => {
	it("orders stable, beta, alpha, deprecated", () => {
		expect(STAGE_ORDER).toEqual(["stable", "beta", "alpha", "deprecated"]);
	});

	it("labels and glyphs every stage", () => {
		expect(
			STAGE_ORDER.map((stage) => `${stageGlyph(stage)} ${stageLabel(stage)}`),
		).toEqual(["● Stable", "◐ Beta", "○ Alpha", "⊘ Deprecated"]);
	});

	const features = [
		{ id: "a", stage: "alpha" as const },
		{ id: "s1", stage: "stable" as const },
		{ id: "b", stage: "beta" as const },
		{ id: "s2", stage: "stable" as const },
	];

	it("counts features per stage, including empty stages", () => {
		expect(stageCounts(features)).toEqual({
			stable: 2,
			beta: 1,
			alpha: 1,
			deprecated: 0,
		});
		expect(stageCounts([])).toEqual({
			stable: 0,
			beta: 0,
			alpha: 0,
			deprecated: 0,
		});
	});

	it("groups in stage order, keeps feature order and drops empty stages", () => {
		expect(
			groupByStage(features).map((group) => [
				group.stage,
				group.features.map((feature) => feature.id),
			]),
		).toEqual([
			["stable", ["s1", "s2"]],
			["beta", ["b"]],
			["alpha", ["a"]],
		]);
	});
});
