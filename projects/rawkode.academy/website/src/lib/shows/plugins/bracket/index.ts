import type {
	ShowExtension,
	ShowPageModule,
	ShowPlugin,
} from "@/lib/shows/types";
import { bracketEndpoints } from "./endpoints";
import Apply from "./pages/Apply.astro";
import Brackets from "./pages/Brackets.astro";
import Leaderboard from "./pages/Leaderboard.astro";
import Schedule from "./pages/Schedule.astro";
import {
	loadBrackets,
	loadLeaderboard,
	loadMyParticipation,
	loadSchedule,
	type BracketsReadBinding,
} from "./queries";

export type BracketPageSlug = "brackets" | "schedule" | "leaderboard" | "apply";

export interface BracketPluginConfig {
	showId: string;
	// Which pages to expose, in nav order. Defaults to all four.
	enabledPages?: BracketPageSlug[];
}

const READ_CACHE =
	"public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

// Reusable Bracket plugin: any bracket-style show instantiates this with its
// showId. Data is read from the federated GraphQL API; writes (apply) go to the
// brackets write-model via the website's BRACKETS_WRITE service binding.
export const bracketPlugin: ShowPlugin<BracketPluginConfig> = (
	config,
): ShowExtension => {
	const { showId } = config;

	const allPages: Record<BracketPageSlug, ShowPageModule> = {
		brackets: {
			slug: "brackets",
			label: "Brackets",
			cache: READ_CACHE,
			load: async () => ({ brackets: await loadBrackets(showId) }),
			meta: () => ({ title: "Brackets" }),
			Component: Brackets,
		},
		schedule: {
			slug: "schedule",
			label: "Schedule",
			cache: READ_CACHE,
			load: async () => ({ matches: await loadSchedule(showId) }),
			meta: () => ({ title: "Schedule" }),
			Component: Schedule,
		},
		leaderboard: {
			slug: "leaderboard",
			label: "Leaderboard",
			cache: READ_CACHE,
			load: async () => ({ standings: await loadLeaderboard(showId) }),
			meta: () => ({ title: "Leaderboard" }),
			Component: Leaderboard,
		},
		apply: {
			slug: "apply",
			label: "Apply",
			load: async (ctx) => {
				const readModel =
					(ctx.env.BRACKETS_READ as BracketsReadBinding | undefined) ?? null;
				return {
					showId,
					isSignedIn: Boolean(ctx.locals.user),
					participation: await loadMyParticipation(showId, {
						readModel,
						user: ctx.locals.user ? { id: ctx.locals.user.id } : null,
					}),
					submitted: ctx.url.searchParams.get("submitted") === "1",
				};
			},
			meta: () => ({ title: "Apply to compete" }),
			Component: Apply,
		},
	};

	const order: BracketPageSlug[] = config.enabledPages ?? [
		"brackets",
		"schedule",
		"leaderboard",
		"apply",
	];

	return {
		showId,
		pages: order.map((slug) => allPages[slug]),
		endpoints: bracketEndpoints(showId),
	};
};
