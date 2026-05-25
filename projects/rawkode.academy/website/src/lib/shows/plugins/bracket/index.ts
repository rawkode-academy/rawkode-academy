import type {
	ShowExtension,
	ShowPageModule,
	ShowPlugin,
} from "@/lib/shows/types";
import { bracketEndpoints } from "./endpoints";
import Apply from "./pages/Apply.astro";
import Brackets from "./pages/Brackets.astro";
import Seasons from "./pages/Seasons.astro";
import Schedule from "./pages/Schedule.astro";
import {
	loadBrackets,
	loadMyParticipation,
	loadSchedule,
	loadSeasons,
	requireBracketsReadBinding,
} from "./queries";

export type BracketPageSlug = "seasons" | "brackets" | "schedule" | "apply";

export interface BracketPluginConfig {
	showId: string;
	// Which pages to expose, in nav order. Defaults to all four.
	enabledPages?: BracketPageSlug[];
}

const READ_CACHE =
	"public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

// Reusable Bracket plugin: any bracket-style show instantiates this with its
// showId. Data is read through BRACKETS_READ; writes (apply) go to the brackets
// write-model via the website's BRACKETS_WRITE service binding.
export const bracketPlugin: ShowPlugin<BracketPluginConfig> = (
	config,
): ShowExtension => {
	const { showId } = config;

	const allPages: Record<BracketPageSlug, ShowPageModule> = {
		seasons: {
			slug: "seasons",
			label: "Seasons",
			cache: READ_CACHE,
			load: async (ctx) => ({
				showId: ctx.showId,
				seasons: await loadSeasons(showId, requireBracketsReadBinding(ctx.env)),
			}),
			meta: () => ({ title: "Seasons" }),
			Component: Seasons,
		},
		brackets: {
			slug: "brackets",
			label: "Brackets",
			cache: READ_CACHE,
			load: async (ctx) => ({
				brackets: await loadBrackets(
					showId,
					requireBracketsReadBinding(ctx.env),
				),
			}),
			meta: () => ({ title: "Brackets" }),
			Component: Brackets,
		},
		schedule: {
			slug: "schedule",
			label: "Schedule",
			cache: READ_CACHE,
			load: async (ctx) => ({
				matches: await loadSchedule(
					showId,
					requireBracketsReadBinding(ctx.env),
				),
			}),
			meta: () => ({ title: "Schedule" }),
			Component: Schedule,
		},
		apply: {
			slug: "apply",
			label: "Apply",
			load: async (ctx) => {
				const readModel = requireBracketsReadBinding(ctx.env);
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
		"seasons",
		"brackets",
		"schedule",
		"apply",
	];

	return {
		showId,
		pages: order.map((slug) => allPages[slug]),
		endpoints: bracketEndpoints(showId),
	};
};
