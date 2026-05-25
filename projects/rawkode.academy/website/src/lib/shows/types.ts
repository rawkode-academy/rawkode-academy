import type { AstroComponentFactory } from "astro/runtime/server/index.js";

// Cloudflare runtime env exposed via Astro.locals.runtime.env.
export type ShowEnv = Record<string, unknown>;

export interface ShowPageContext {
	showId: string;
	slug: string;
	params: Record<string, string | undefined>;
	request: Request;
	url: URL;
	env: ShowEnv;
	locals: App.Locals;
}

export interface ShowPageMeta {
	title: string;
	description?: string | undefined;
}

// A single page a plugin contributes under /shows/<showId>/<slug>.
// `load` runs server-side before the layout renders, so it can resolve both
// the page data and the document title; `Component` receives the data as props.
export interface ShowPageModule {
	slug: string;
	label: string;
	icon?: string;
	// When true the page is reachable by URL but omitted from the tab nav.
	hidden?: boolean;
	load?: (ctx: ShowPageContext) => Promise<Record<string, unknown>>;
	meta?: (data: Record<string, unknown>) => ShowPageMeta;
	cache?: string;
	Component: AstroComponentFactory;
}

// A show-scoped API endpoint under /api/shows/<showId>/<slug>.
export interface ShowEndpointModule {
	slug: string;
	handler: (ctx: ShowPageContext) => Response | Promise<Response>;
}

export interface ShowExtension {
	showId: string;
	pages: ShowPageModule[];
	endpoints?: ShowEndpointModule[];
}

// A reusable plugin (Bracket, Quiz, Poll, ...): a factory that, given a
// per-show config, produces the pages and endpoints for that show.
export type ShowPlugin<Config> = (config: Config) => ShowExtension;

export interface ShowNavItem {
	slug: string;
	label: string;
	icon?: string | undefined;
}
