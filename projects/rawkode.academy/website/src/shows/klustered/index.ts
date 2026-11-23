import { bracketPlugin } from "@/lib/shows/plugins/bracket";
import type { ShowExtension } from "@/lib/shows/types";

// Klustered is the first consumer of the reusable Bracket plugin. Its public
// pages and endpoints stay switched off while /shows/klustered is a holding
// notice; list slugs here to expose them again.
export const klusteredExtension: ShowExtension = bracketPlugin({
	showId: "klustered",
	enabledPages: [],
	enabledEndpoints: [],
});
