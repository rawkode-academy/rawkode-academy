import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderOnlyActionsPlugin } from "../utils/vite-plugin-render-only-actions";

const src = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`;
const { handler } = renderOnlyActionsPlugin().transform;
const run = (environment: string, id: string, code: string) =>
	handler.call({ environment: { name: environment } }, code, id);

describe("render-only astro:actions", () => {
	const component = `${src}components/newsletter/NewsletterWidget.vue`;
	const code = `import { actions } from "astro:actions";`;

	it("gives server-rendered components the client entrypoint", () => {
		expect(run("ssr", component, code)?.code).toBe(
			`import { actions } from "astro/actions/runtime/entrypoints/client.js";`,
		);
		expect(run("prerender", component, code)?.code).toContain(
			"entrypoints/client.js",
		);
	});

	it("leaves the browser build, action definitions and middleware alone", () => {
		expect(run("client", component, code)).toBeNull();
		expect(run("ssr", `${src}actions/newsletter.ts`, code)).toBeNull();
		expect(run("ssr", `${src}middleware.ts`, code)).toBeNull();
		expect(run("ssr", "/elsewhere/node_modules/x/index.js", code)).toBeNull();
	});

	it("keeps pages and components off the action definitions", () => {
		// Importing src/actions/** pulls the server `astro:actions` (and with it
		// every page) back into a page's graph; share helpers through src/lib.
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) walk(path);
				else if (/\.(astro|vue|tsx?)$/.test(entry.name)) {
					if (
						/from\s+["'](@\/actions|(\.\.\/)+actions)\//.test(
							readFileSync(path, "utf8"),
						)
					)
						offenders.push(path.slice(src.length));
				}
			}
		};
		for (const dir of ["components", "layouts", "pages", "wrappers"])
			walk(`${src}${dir}`);
		expect(offenders).toEqual([]);
	});
});
