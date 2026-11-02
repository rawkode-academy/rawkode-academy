import type { KubeTrackReleaseData } from "@/lib/live-content/types";

export type {
	KubeTrackFeatureData,
	KubeTrackQuizQuestionData,
	KubeTrackReleaseData,
	KubeTrackStage,
} from "@/lib/live-content/types";

/**
 * The parts of a `kubetrackReleases` entry this module reads; a
 * `ContentEntry<"kubetrackReleases">` satisfies it.
 */
export interface KubeTrackReleaseEntry {
	id: string;
	data: KubeTrackReleaseData;
}
