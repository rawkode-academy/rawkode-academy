import { bracketPlugin } from "@/lib/shows/plugins/bracket";
import type { ShowExtension, ShowPageModule } from "@/lib/shows/types";
import ApplicationsPaused from "./ApplicationsPaused.astro";

const bracketExtension = bracketPlugin({
	showId: "klustered",
	enabledPages: ["apply"],
	enabledEndpoints: [],
});

const pausedApplications: ShowPageModule = {
	slug: "apply",
	label: "Apply",
	meta: () => ({ title: "Klustered applications" }),
	Component: ApplicationsPaused,
};

// Keep the stable Apply URL while the account flow is unavailable. The
// reusable bracket plugin remains the source of Klustered's extension shape,
// but the public page has no read/write service dependency or application form.
export const klusteredExtension: ShowExtension = {
	...bracketExtension,
	pages: bracketExtension.pages.map((page) =>
		page.slug === pausedApplications.slug ? pausedApplications : page,
	),
};
