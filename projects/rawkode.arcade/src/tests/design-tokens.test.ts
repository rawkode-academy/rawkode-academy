import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "bun:test";

/**
 * Design-system guard.
 *
 * Panda is configured with `strictTokens` and `strictPropertyValues`, but that
 * only constrains values that actually reach Panda. Astro `<style>` blocks and
 * Vue `<style scoped>` blocks are invisible to its static extractor, which is
 * how the first implementation ended up with 19 hand-written stylesheets and
 * 229 raw `var(--…)` references against a palette declared twice.
 *
 * Closing that hole needs a check outside Panda. This test is it: it reads the
 * source, fails on every known bypass, and computes contrast and type-size
 * floors from the token values so accessibility is enforced by the build
 * rather than by review.
 *
 * It mirrors the same pattern the website uses in
 * `projects/rawkode.academy/website/src/tests/design-tokens.test.ts`.
 */

const projectRoot = new URL("../..", import.meta.url).pathname;

const MARKUP_EXTENSIONS = [".astro", ".vue"];
const SOURCE_EXTENSIONS = [...MARKUP_EXTENSIONS, ".ts"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", "styled-system"]);

/** This file names the patterns it bans, so it cannot scan itself. */
const SELF = "src/tests/design-tokens.test.ts";

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
		} else {
			yield join(dir, entry.name);
		}
	}
}

function sourceFiles(extensions: readonly string[]): string[] {
	return [...walk(join(projectRoot, "src"))]
		.filter((file) => extensions.some((ext) => file.endsWith(ext)))
		.map((file) => relative(projectRoot, file))
		.filter((file) => file !== SELF)
		.sort();
}

function read(file: string): string {
	return readFileSync(join(projectRoot, file), "utf-8");
}

/** Strip comments so prose describing a banned pattern is not a violation. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1")
		.replace(/<!--[\s\S]*?-->/g, "");
}

function offenders(
	files: readonly string[],
	pattern: RegExp,
	transform: (source: string) => string = stripComments,
): string[] {
	return files.filter((file) => {
		pattern.lastIndex = 0;
		return pattern.test(transform(read(file)));
	});
}

describe("panda is the only styling surface", () => {
	it("has no <style> block in any .astro or .vue file", () => {
		// The whole point. A style block is invisible to Panda, so anything in
		// it escapes strictTokens, the contrast floor and the type scale.
		expect(offenders(sourceFiles(MARKUP_EXTENSIONS), /<style[\s>]/)).toEqual([]);
	});

	it("has no raw custom-property reference outside the generated output", () => {
		// The Academy font variables are the one legitimate escape: Astro's
		// fonts API owns them and Panda references them from its own tokens.
		const allowed = /var\(--font-(instrument-serif|inter-tight|jetbrains-mono)\)/g;
		expect(
			offenders(sourceFiles(SOURCE_EXTENSIONS), /var\(--/, (source) =>
				stripComments(source)
					.replace(allowed, "")
					.replace(/var\(--arcade-sweep\)/g, ""),
			),
		).toEqual([]);
	});

	it("has no hex colour literal", () => {
		// `<meta name="theme-color">` is the one place a hex is unavoidable:
		// it is an HTML attribute, not CSS, so no token can reach it. Its
		// value is pinned against the ground token below.
		expect(
			offenders(sourceFiles(SOURCE_EXTENSIONS), /#[0-9a-fA-F]{3,8}\b/, (source) =>
				stripComments(source).replace(
					/<meta name="theme-color" content="#[0-9a-f]{6}" \/>/,
					"",
				),
			),
		).toEqual([]);
	});

	it("pins theme-color to the ground token", () => {
		const declared = read("src/layouts/ArcadeLayout.astro").match(
			/theme-color" content="(#[0-9a-f]{6})"/,
		)?.[1];
		expect(declared).toBeDefined();
		const ground = parseOklch(configTokens("colors").ground);
		const expected = `#${oklchToLinearSrgb(ground)
			.map((channel) => {
				const clamped = Math.min(Math.max(channel, 0), 1);
				const srgb =
					clamped <= 0.0031308
						? clamped * 12.92
						: 1.055 * clamped ** (1 / 2.4) - 0.055;
				return Math.round(srgb * 255)
					.toString(16)
					.padStart(2, "0");
			})
			.join("")}`;
		expect(declared).toBe(expected);
	});

	it("has no bare px, rem, em or vmin literal", () => {
		// Every length belongs to a scale. `1px` in a component means the
		// spacing ramp did not have what the author needed, which is a config
		// change, not a local override.
		expect(
			offenders(
				sourceFiles(SOURCE_EXTENSIONS),
				/(?<![\w-])\d+(?:\.\d+)?(px|rem|em|vmin|vmax|vh|vw)(?![\w-])/,
			),
		).toEqual([]);
	});

	it("has no static inline style attribute", () => {
		// An unbound `style="…"` is a value Panda never sees.
		expect(
			offenders(sourceFiles(MARKUP_EXTENSIONS), /(?<![:\w-])style="/),
		).toEqual([]);
	});

	it("has no colour literal in a bound style attribute", () => {
		// A bound `:style` is allowed only for values no token can express,
		// such as the progress bar's runtime percentage. A colour is never
		// one of those: the previous implementation piped team hexes from the
		// database straight into `:style`, which no static check could see.
		expect(
			offenders(
				sourceFiles(MARKUP_EXTENSIONS),
				/:style="[^"]*(#|rgb|hsl|oklch|colour|color)/i,
			),
		).toEqual([]);
	});

	it("keeps the palette in exactly one place", () => {
		const globalCss = read("src/styles/global.css");
		expect(globalCss).not.toMatch(/:root\s*\{/);
		expect(globalCss).toContain("styled-system/styles.css");
	});

	it("keeps both Panda strict modes on", () => {
		const config = read("panda.config.ts");
		expect(config).toMatch(/strictTokens:\s*true/);
		expect(config).toMatch(/strictPropertyValues:\s*true/);
	});
});

/* ------------------------------------------------------------- contrast -- */

type Oklch = { l: number; c: number; h: number; alpha: number };

function parseOklch(value: string): Oklch {
	const match = value.match(
		/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)/,
	);
	if (!match) throw new Error(`Not an oklch value: ${value}`);
	const rawAlpha = match[4];
	return {
		l: Number(match[1]),
		c: Number(match[2]),
		h: Number(match[3]),
		alpha: rawAlpha
			? rawAlpha.endsWith("%")
				? Number(rawAlpha.slice(0, -1)) / 100
				: Number(rawAlpha)
			: 1,
	};
}

/** OKLCH to linear sRGB, per the CSS Color 4 conversion. */
function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

	return [
		4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
		-1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
		-0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
	];
}

/** WCAG 2.1 relative luminance, which is defined on linear-light sRGB. */
function relativeLuminance(colour: Oklch): number {
	const [r, g, b] = oklchToLinearSrgb(colour).map((channel) =>
		Math.min(Math.max(channel, 0), 1),
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
	const a = relativeLuminance(parseOklch(foreground));
	const b = relativeLuminance(parseOklch(background));
	const [lighter, darker] = a > b ? [a, b] : [b, a];
	return (lighter + 0.05) / (darker + 0.05);
}

/** Pull `name: { value: "…" }` pairs straight out of the config. */
function configTokens(category: string): Record<string, string> {
	const config = read("panda.config.ts");
	const start = config.indexOf(`${category}: {`);
	if (start === -1) throw new Error(`No ${category} token block found`);

	const tokens: Record<string, string> = {};
	let depth = 0;
	let index = config.indexOf("{", start);
	const open = index;
	for (; index < config.length; index += 1) {
		if (config[index] === "{") depth += 1;
		else if (config[index] === "}") {
			depth -= 1;
			if (depth === 0) break;
		}
	}
	const block = config.slice(open, index);
	for (const match of block.matchAll(
		/(\w+):\s*\{\s*value:\s*\n?\s*"([^"]+)"/g,
	)) {
		tokens[match[1]] = match[2];
	}
	return tokens;
}

describe("tokens meet WCAG AA by construction", () => {
	const colours = configTokens("colors");
	const grounds = ["ground", "surface", "surfaceRaised"] as const;

	// Text tones must clear 4.5:1 on every surface they are allowed to sit on.
	// inkMute is the floor of the ramp; there is deliberately nothing below it.
	for (const tone of ["ink", "inkSoft", "inkMute"]) {
		for (const ground of grounds) {
			it(`${tone} on ${ground} clears 4.5:1`, () => {
				const ratio = contrastRatio(colours[tone], colours[ground]);
				expect(
					Number(ratio.toFixed(2)),
					`${tone} on ${ground} is ${ratio.toFixed(2)}:1`,
				).toBeGreaterThanOrEqual(4.5);
			});
		}
	}

	// Accents carry text (scores, slugs, labels), so they are held to the same
	// bar rather than the 3:1 large-text allowance.
	for (const accent of ["amber", "spruce", "rust", "violet"]) {
		for (const ground of grounds) {
			it(`${accent} on ${ground} clears 4.5:1`, () => {
				const ratio = contrastRatio(colours[accent], colours[ground]);
				expect(
					Number(ratio.toFixed(2)),
					`${accent} on ${ground} is ${ratio.toFixed(2)}:1`,
				).toBeGreaterThanOrEqual(4.5);
			});
		}
	}

	// Filled controls put ground-coloured text on an accent.
	for (const accent of ["amber", "spruce"]) {
		it(`ground text on a filled ${accent} control clears 4.5:1`, () => {
			const ratio = contrastRatio(colours.ground, colours[accent]);
			expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(4.5);
		});
	}
});

describe("text stays legible on accent-tinted surfaces", () => {
	const colours = configTokens("colors");

	/** Flatten `accent / alpha` over an opaque backdrop in linear sRGB. */
	function composite(tint: string, backdrop: string): number {
		const front = parseOklch(tint);
		const back = parseOklch(backdrop);
		const f = oklchToLinearSrgb(front);
		const b = oklchToLinearSrgb(back);
		const mixed = f.map((channel, index) =>
			Math.min(Math.max(channel * front.alpha + b[index] * (1 - front.alpha), 0), 1),
		) as [number, number, number];
		return 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2];
	}

	function ratioOn(foreground: string, tint: string, backdrop: string): number {
		const a = relativeLuminance(parseOklch(foreground));
		const b = composite(tint, backdrop);
		const [lighter, darker] = a > b ? [a, b] : [b, a];
		return (lighter + 0.05) / (darker + 0.05);
	}

	// Selected rows, notices and live panels put text on an accent tint over a
	// surface. axe caught inkMute at 3.89:1 there; the token test could not
	// see it, because it only compared against the opaque surfaces.
	for (const tint of ["amberDim", "spruceDim", "rustDim", "violetDim"]) {
		for (const backdrop of ["ground", "surface"]) {
			for (const tone of ["ink", "inkSoft"]) {
				it(`${tone} on ${tint} over ${backdrop} clears 4.5:1`, () => {
					const ratio = ratioOn(colours[tone], colours[tint], colours[backdrop]);
					expect(
						Number(ratio.toFixed(2)),
						`${tone} on ${tint} over ${backdrop} is ${ratio.toFixed(2)}:1`,
					).toBeGreaterThanOrEqual(4.5);
				});
			}
		}
	}

	it("keeps inkMute off accent tints", () => {
		// inkMute is the floor of the ramp and does not survive a tint. Any
		// component putting it on a *Dim surface is a bug; use inkSoft.
		const markup = sourceFiles(MARKUP_EXTENSIONS)
			.map((file) => ({ file, source: stripComments(read(file)) }))
			.filter(({ source }) => /tone:\s*'mute'/.test(source) && /Dim/.test(source))
			.map(({ file }) => file);
		expect(markup).toEqual([]);
	});
});

describe("the type scale has a floor", () => {
	const fontSizes = configTokens("fontSizes");

	it("has no rem-based token below 0.75rem", () => {
		const tooSmall = Object.entries(fontSizes).filter(([, value]) => {
			const match = value.match(/^([\d.]+)rem$/);
			return match ? Number(match[1]) < 0.75 : false;
		});
		expect(tooSmall).toEqual([]);
	});

	it("reserves 0.75rem for the mono metadata label only", () => {
		// 12px is legible as a tracked mono label and illegible as prose. The
		// previous implementation had twelve distinct sizes below 0.75rem.
		const atFloor = Object.entries(fontSizes)
			.filter(([, value]) => value === "0.75rem")
			.map(([name]) => name);
		expect(atFloor).toEqual(["label"]);
	});

	it("keeps the display clamp at or below 6rem", () => {
		const max = fontSizes.display.match(/,\s*([\d.]+)rem\s*\)/);
		expect(Number(max?.[1])).toBeLessThanOrEqual(6);
	});

	it("keeps the broadcast scale in vmin", () => {
		for (const [name, value] of Object.entries(fontSizes)) {
			if (name.startsWith("cast")) expect(value).toMatch(/vmin$/);
		}
	});
});

describe("banned visual patterns stay gone", () => {
	const files = sourceFiles(SOURCE_EXTENSIONS);

	it("has no glassmorphism", () => {
		expect(offenders(files, /backdropFilter|backdrop-filter/)).toEqual([]);
	});

	it("has no gradient text", () => {
		expect(offenders(files, /backgroundClip:\s*"text"|background-clip:\s*text/)).toEqual([]);
	});

	it("has no coloured side-stripe border", () => {
		// A 2px+ coloured border-left on a card or row is decoration, and it
		// makes colour the only carrier of state.
		expect(
			offenders(files, /border(Left|Right)Width:\s*"(rule|heavy)"/),
		).toEqual([]);
	});

	it("does not colour-code the game formats", () => {
		// A format is a category, not a state. Six hues is what made the first
		// implementation read as generated.
		const catalogue = read("src/lib/game-catalogue.ts");
		expect(catalogue).not.toMatch(/accent:\s*"/);
	});
});
