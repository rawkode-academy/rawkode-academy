import { bracketPlugin } from "@/lib/shows/plugins/bracket";
import type { ShowExtension } from "@/lib/shows/types";

// Stands in for @/shows/klustered when a test exercises the bracket plugin's
// public pages and endpoints, which the real Klustered extension switches off.
export const klusteredExtension: ShowExtension = bracketPlugin({
	showId: "klustered",
});
