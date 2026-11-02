import type { KubeTrackStage } from "./types";

const VERSION_PATTERN = /^v?(\d+)\.(\d+)(\.\d+)?$/;

/** "v1.37", "1.37.0" and "1.37" all become "1.37"; anything else is null. */
export function canonicalVersion(
	raw: string | null | undefined,
): string | null {
	const match = VERSION_PATTERN.exec((raw ?? "").trim());
	if (!match) return null;
	return `${Number(match[1])}.${Number(match[2])}`;
}

export const STAGE_ORDER: readonly KubeTrackStage[] = [
	"stable",
	"beta",
	"alpha",
	"deprecated",
] as const;

const LABELS: Record<KubeTrackStage, string> = {
	stable: "Stable",
	beta: "Beta",
	alpha: "Alpha",
	deprecated: "Deprecated",
};

const GLYPHS: Record<KubeTrackStage, string> = {
	stable: "●",
	beta: "◐",
	alpha: "○",
	deprecated: "⊘",
};

export const stageLabel = (stage: KubeTrackStage): string => LABELS[stage];
export const stageGlyph = (stage: KubeTrackStage): string => GLYPHS[stage];

export function stageCounts(
	features: ReadonlyArray<{ stage: KubeTrackStage }>,
): Record<KubeTrackStage, number> {
	const counts: Record<KubeTrackStage, number> = {
		stable: 0,
		beta: 0,
		alpha: 0,
		deprecated: 0,
	};
	for (const feature of features) counts[feature.stage]++;
	return counts;
}

/** Features grouped in STAGE_ORDER, keeping their order; empty stages are left out. */
export function groupByStage<T extends { stage: KubeTrackStage }>(
	features: ReadonlyArray<T>,
): { stage: KubeTrackStage; features: T[] }[] {
	return STAGE_ORDER.map((stage) => ({
		stage,
		features: features.filter((feature) => feature.stage === stage),
	})).filter((group) => group.features.length > 0);
}
