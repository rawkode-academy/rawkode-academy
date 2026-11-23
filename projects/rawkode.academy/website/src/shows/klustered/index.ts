import { bracketPlugin } from "@/lib/shows/plugins/bracket";
import type { ShowExtension } from "@/lib/shows/types";
import { klusteredEnabledEndpoints, klusteredEnabledPages } from "./config";

// Klustered is the first consumer of the reusable Bracket plugin.
export const klusteredExtension: ShowExtension = bracketPlugin({
	showId: "klustered",
	enabledPages: [...klusteredEnabledPages],
	enabledEndpoints: [...klusteredEnabledEndpoints],
});
