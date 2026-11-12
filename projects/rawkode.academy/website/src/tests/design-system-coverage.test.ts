import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as designSystem from "@rawkodeacademy/design-system";
import { describe, expect, it } from "vitest";

/**
 * Panda extracts recipe styles statically. A recipe that builds its styles
 * in a way the extractor cannot follow (a helper function, a computed key)
 * still returns class names at runtime, but no CSS is generated for them and
 * the element silently renders unstyled. This test closes that gap: every
 * class a recipe can emit must have a rule in the built stylesheet.
 */

type Recipe = ((variants?: Record<string, unknown>) => unknown) & {
	variantMap: Record<string, string[]>;
};

const isRecipe = (value: unknown): value is Recipe =>
	typeof value === "function" && "variantMap" in value;

const stylesheet = readFileSync(
	join(
		process.cwd(),
		"../../../packages/design-system/styled-system/styles.css",
	),
	"utf-8",
);

// Class selectors as written in CSS escape punctuation with a backslash.
const defined = new Set(
	Array.from(stylesheet.matchAll(/\.((?:\\.|[\w-])+)/g), (match) =>
		match[1]!.replace(/\\(.)/g, "$1"),
	),
);

const classesOf = (output: unknown): string[] =>
	(typeof output === "string" ? [output] : Object.values(output as object))
		.flatMap((value) => String(value).split(/\s+/))
		.filter(Boolean);

const coerce = (value: string) =>
	value === "true" ? true : value === "false" ? false : value;

function emittedClasses(recipe: Recipe): Set<string> {
	const classes = new Set(classesOf(recipe()));
	const variants = Object.entries(recipe.variantMap);
	for (const [name, values] of variants) {
		for (const value of values) {
			for (const cls of classesOf(recipe({ [name]: coerce(value) }))) {
				classes.add(cls);
			}
			// Compound variants only resolve when two variants meet.
			for (const [otherName, otherValues] of variants) {
				if (otherName === name) continue;
				for (const otherValue of otherValues) {
					const combined = recipe({
						[name]: coerce(value),
						[otherName]: coerce(otherValue),
					});
					for (const cls of classesOf(combined)) classes.add(cls);
				}
			}
		}
	}
	return classes;
}

const recipes = Object.entries(designSystem).filter(
	(entry): entry is [string, Recipe] => isRecipe(entry[1]),
);

describe("design-system stylesheet coverage", () => {
	it("finds the recipes", () => {
		expect(recipes.length).toBeGreaterThan(20);
		expect(defined.size).toBeGreaterThan(500);
	});

	it.each(
		recipes,
	)("%s emits only classes the stylesheet defines", (_name, recipe) => {
		const missing = [...emittedClasses(recipe)].filter(
			(cls) => !defined.has(cls),
		);
		expect(missing).toEqual([]);
	});
});
