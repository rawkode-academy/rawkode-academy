import { afterAll, beforeAll, expect, test } from "bun:test";
import { BINDINGS, COLLECTIONS } from "../src/lib/collections";
import { type Harness, harness } from "./harness";

// The registry names models, panels and reference columns by hand; this
// checks every name against what the write models actually define.
let h: Harness;
beforeAll(async () => {
	h = await harness([...BINDINGS]);
});
afterAll(() => h.dispose());

test("every collection, panel and reference points at a real model", async () => {
	const problems: string[] = [];
	const describe = async (binding: (typeof BINDINGS)[number]) =>
		h.env.services[binding]?.describe() ?? [];
	for (const c of COLLECTIONS) {
		const entity = (await describe(c.binding)).find((m) => m.name === c.model);
		if (entity?.kind !== "entity")
			problems.push(`${c.name}: no entity "${c.model}"`);
		const fieldNames = new Set(entity?.fields.map((f) => f.name));
		if (entity && !fieldNames.has(c.titleField)) {
			problems.push(`${c.name}: no title field "${c.titleField}"`);
		}
		for (const panel of c.panels) {
			const model = (await describe(panel.binding)).find(
				(m) => m.name === panel.model,
			);
			if (
				!model ||
				model.kind !== (panel.kind === "list" ? "list" : "entity")
			) {
				problems.push(
					`${c.name}/${panel.name}: no ${panel.kind} model "${panel.model}"`,
				);
				continue;
			}
			if (panel.kind === "list") {
				const parent = Object.keys(panel.parent({ id: "x", slug: "x" }));
				if (JSON.stringify(parent) !== JSON.stringify(model.parent)) {
					problems.push(
						`${c.name}/${panel.name}: parent ${parent} != ${model.parent}`,
					);
				}
				if (
					panel.picks &&
					!model.fields.some((f) => f.name === panel.picks?.field)
				) {
					problems.push(
						`${c.name}/${panel.name}: no picked field "${panel.picks.field}"`,
					);
				}
			} else if (model.key !== panel.keyField) {
				problems.push(
					`${c.name}/${panel.name}: key ${model.key} != ${panel.keyField}`,
				);
			}
		}
		for (const ref of c.references) {
			const refs = await h.env.services[ref.binding]?.findReferences(
				ref.model,
				ref.column,
				"x",
			);
			if (!refs?.ok)
				problems.push(
					`${c.name}: reference ${ref.model}.${ref.column} is invalid`,
				);
		}
	}
	expect(problems).toEqual([]);
});
