// Code highlighting with Expressive Code's core on Workers: the same engine,
// plugins (frames, Shiki, text markers), theme and style overrides that
// astro-expressive-code used at build time, with Shiki's JavaScript regex
// engine instead of Oniguruma WebAssembly.
//
// Bundle: ~0.2 MB of Expressive Code + PostCSS, plus the grammars listed in
// shiki-langs.ts (loaded lazily per language). See the migration guide.
import {
	type ExpressiveCodeEngine,
	type ExpressiveCodeEngineConfig,
	ExpressiveCodeTheme,
} from "@expressive-code/core";
import { toHtml as hastToHtml } from "@expressive-code/core/hast";
import cueGrammar from "../../../grammars/cue.tmLanguage.json";

export interface CodeAssets {
	/** CSS for every code block on a page (base + theme). */
	styles: string;
	/** Client modules (copy button). */
	scripts: string[];
}

let enginePromise: Promise<ExpressiveCodeEngine> | undefined;
let assetsPromise: Promise<CodeAssets> | undefined;

async function createEngine(): Promise<ExpressiveCodeEngine> {
	const [
		{ ExpressiveCodeEngine: Engine, definePlugin },
		{ pluginShiki },
		{ pluginFrames },
		{ pluginTextMarkers },
		mocha,
	] = await Promise.all([
		import("@expressive-code/core"),
		import("@expressive-code/plugin-shiki"),
		import("@expressive-code/plugin-frames"),
		import("@expressive-code/plugin-text-markers"),
		import("shiki/themes/catppuccin-mocha.mjs"),
	]);
	const config: ExpressiveCodeEngineConfig = {
		themes: [
			new ExpressiveCodeTheme((mocha as { default: object }).default as never),
		],
		plugins: [
			pluginFrames(),
			pluginShiki({
				engine: "javascript",
				// The grammar is named "CUE"; fences say "cue", so register it under
				// that id or CUE blocks render as plain text.
				langs: [{ ...cueGrammar, name: "cue", aliases: ["CUE"] } as never],
			}),
			pluginTextMarkers(),
			definePlugin({
				name: "academy-code-controls",
				// The renderer otherwise shrinks copy targets to 32px for a mouse.
				// Keep the Academy's 44px target for pointer and touch alike.
				baseStyles: `
					.frame .copy button { min-width: 2.75rem; min-height: 2.75rem; }
					.frame .copy button::after { mask-position: center; mask-size: 1.25rem; }
				`,
			}),
		],
		// Code blocks are "screen within the page" surfaces: like the
		// --terminal-* tokens they stay dark in both colour schemes.
		styleOverrides: {
			borderRadius: "var(--radius-sm)",
			borderColor: "var(--terminal-border)",
			borderWidth: "1px",
			codeBackground: "var(--terminal-bg)",
			codeFontFamily:
				"var(--font-red-hat-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
			codeFontSize: "13px",
			codeLineHeight: "1.7",
			frames: {
				editorActiveTabBackground: "transparent",
				editorActiveTabBorderColor: "transparent",
				editorActiveTabIndicatorBottomColor: "transparent",
				editorActiveTabIndicatorTopColor: "var(--editorial-spruce)",
				editorBackground: "var(--terminal-bg)",
				editorTabBarBackground: "var(--terminal-surface)",
				editorTabBarBorderBottomColor: "var(--terminal-border)",
				frameBoxShadowCssValue: "none",
				terminalBackground: "var(--terminal-bg)",
				terminalTitlebarBackground: "var(--terminal-surface)",
				terminalTitlebarBorderBottomColor: "var(--terminal-border)",
				terminalTitlebarDotsForeground: "oklch(1 0 0 / 0.18)",
			},
		} as ExpressiveCodeEngineConfig["styleOverrides"],
	};
	return new Engine(config);
}

function engine(): Promise<ExpressiveCodeEngine> {
	enginePromise ??= createEngine().catch((error) => {
		enginePromise = undefined;
		throw error;
	});
	return enginePromise;
}

/** Build the fence meta Expressive Code parses (title="…" plus the rest). */
export function codeMeta(title: string | null, meta: string | null): string {
	const parts: string[] = [];
	if (title) parts.push(`title=${JSON.stringify(title)}`);
	if (meta) parts.push(meta);
	return parts.join(" ");
}

export async function highlightCode(
	code: string,
	language: string | null,
	title: string | null,
	meta: string | null,
): Promise<{ html: string; styles: string }> {
	const ec = await engine();
	const { renderedGroupAst, styles } = await ec.render({
		// rehype-expressive-code's default tabWidth: tabs become two spaces.
		code: code.replace(/\t/g, "  "),
		language: language ?? "plaintext",
		meta: codeMeta(title, meta),
	});
	return { html: hastToHtml(renderedGroupAst), styles: [...styles].join("") };
}

export function codeAssets(): Promise<CodeAssets> {
	assetsPromise ??= (async () => {
		const ec = await engine();
		const [base, theme, scripts] = await Promise.all([
			ec.getBaseStyles(),
			ec.getThemeStyles(),
			ec.getJsModules(),
		]);
		return { styles: base + theme, scripts };
	})().catch((error) => {
		assetsPromise = undefined;
		throw error;
	});
	return assetsPromise;
}
