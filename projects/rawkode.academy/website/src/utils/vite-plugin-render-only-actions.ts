import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Astro 7 build workaround: keep page-only CSS on the pages that use it.
//
// On the server, `astro:actions` imports the middleware runtime, which imports
// the route manifest, which imports every page. Astro's build analyzer walks
// *up* the import graph from each script / client:only component to find the
// pages that use it, so any page that imports `astro:actions` (the shell's
// MobileNavigation.vue, every newsletter form, ...) is treated as an ancestor
// of every other page. The result: the games' <script> CSS, the video
// player's client:only CSS and so on were inlined into every on-demand page
// (~120 KB each).
//
// Components and pages only *reference* actions while rendering on the server
// (`Astro.getActionResult(actions.x)`, handlers that run in the browser), so
// during the server builds they get the client entrypoint: the same action
// proxies (identical `toString()` / `queryString`), `isInputError` and
// `isActionError`, without the import edge back to the manifest. The action
// definitions (`src/actions/**`) and middleware keep the real server module.
//
// Astro resolves `astro:actions` itself before any user plugin sees it, so the
// specifier is rewritten in the compiled module instead.
const SERVER_ENVIRONMENTS = new Set(["ssr", "prerender"]);
const CLIENT_ENTRYPOINT = "astro/actions/runtime/entrypoints/client.js";
const SPECIFIER = /(["'])astro:actions\1/g;

const SRC = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`;
const SERVER_ONLY = [`${SRC}actions/`, `${SRC}middleware`];

export function renderOnlyActionsPlugin() {
	return {
		name: "rawkode:render-only-actions",
		apply: "build" as const,
		enforce: "post" as const,
		transform: {
			filter: { code: "astro:actions" },
			handler(
				this: { environment?: { name: string } },
				code: string,
				id: string,
			) {
				if (!SERVER_ENVIRONMENTS.has(this.environment?.name ?? "")) return null;
				if (!id.startsWith(SRC)) return null;
				if (SERVER_ONLY.some((prefix) => id.startsWith(prefix))) return null;
				return {
					code: code.replace(SPECIFIER, `$1${CLIENT_ENTRYPOINT}$1`),
					map: null,
				};
			},
		},
	};
}
