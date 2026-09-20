import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { academyBracket } from "@rawkodeacademy/design-system";
import BracketBoard from "../lib/shows/plugins/bracket/BracketBoard.vue";
import {
	twoRoundBracket,
	longNamesBracket,
} from "../lib/shows/plugins/bracket/BracketBoard.fixtures";
import type { Bracket } from "../lib/shows/plugins/bracket/queries";
import { readFileSync } from "node:fs";
import { transform } from "@astrojs/compiler";

const wrappers: VueWrapper[] = [];
beforeEach(() => vi.mocked(fetch).mockReset());
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});
function board(brackets: Bracket[]) {
	const wrapper = mount(BracketBoard, { props: { brackets } });
	wrappers.push(wrapper);
	return wrapper;
}

describe("pure bracket presentation", () => {
	it("keeps the production Astro wrapper typed and server rendered, without a service import", async () => {
		const source = readFileSync(
			"src/lib/shows/plugins/bracket/pages/Brackets.astro",
			"utf8",
		);
		const compiled = await transform(source, { filename: "Brackets.astro" });
		expect(compiled.diagnostics).toEqual([]);
		expect(source).toContain('import type { Bracket } from "../queries"');
		expect(source).toContain("<BracketBoard brackets={brackets} />");
		expect(source).not.toMatch(/client:|fetch\(|loadBrackets/);
	});
	it("renders honest empty states without inventing matches or making requests", () => {
		const empty = board([]);
		expect(empty.text()).toBe("No brackets are available yet.");
		expect(empty.find('[role="region"]').exists()).toBe(false);
		const pending = board([
			{ ...twoRoundBracket, matches: [], startsAt: "invalid" },
		]);
		expect(pending.text()).toContain(
			"No matches have been announced for this bracket.",
		);
		expect(pending.text()).toContain("Start date to be announced");
		expect(pending.find("time").exists()).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("sorts every match by round and position without changing caller arrays", () => {
		const fixture = structuredClone(twoRoundBracket);
		const before = structuredClone(fixture);
		Object.freeze(fixture.matches);
		const wrapper = board([fixture]);
		expect(wrapper.findAll("h3").map((node) => node.text())).toEqual([
			"Round 1",
			"Round 2",
		]);
		expect(wrapper.findAll("li")).toHaveLength(fixture.matches.length);
		expect(wrapper.findAll("li")[0]!.text()).toContain("Fixture Control Plane");
		expect(wrapper.findAll("li")[1]!.text()).toContain(
			"Fixture Reconcile Crew",
		);
		expect(fixture).toEqual(before);
		expect(wrapper.text()).toContain("Winner: Fixture Control Plane");
		expect(wrapper.text()).toContain("Live");
		expect(wrapper.text()).toContain("TBD");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("retains all long names and seeds, including zero, and marks winners textually", () => {
		const wrapper = board([longNamesBracket]);
		for (const side of longNamesBracket.entries)
			expect(wrapper.text()).toContain(side.displayName);
		expect(wrapper.get('[aria-label="Seed 0"]').text()).toBe("#0");
		expect(wrapper.text()).toContain(
			`Winner: ${longNamesBracket.entries[1]!.displayName}`,
		);
		expect(wrapper.find('[data-winner="true"]').text()).toContain(
			longNamesBracket.entries[1]!.displayName,
		);
	});

	it("does not lose a recorded winner when side IDs are absent or unmatched", () => {
		const fixture = {
			...twoRoundBracket,
			matches: [
				{
					...twoRoundBracket.matches[0]!,
					winner: { displayName: "Recorded winner without ID" },
				},
			],
		};
		expect(board([fixture]).text()).toContain(
			"Winner: Recorded winner without ID",
		);
	});

	it("labels a keyboard-focusable scroll region and provides real round widths", () => {
		const wrapper = board([twoRoundBracket]);
		const region = wrapper.get('[role="region"]');
		expect(region.attributes("tabindex")).toBe("0");
		expect(region.attributes("aria-label")).toBe(
			`${twoRoundBracket.name} rounds`,
		);
		const hint = wrapper
			.findAll("p")
			.find(
				(p) => p.attributes("id") === region.attributes("aria-describedby"),
			);
		expect(hint?.text()).toContain("arrow keys");
		const s = academyBracket.raw();
		expect(s.board).toMatchObject({
			overflowX: "auto",
			width: "full",
			minWidth: "0",
		});
		expect(s.round).toMatchObject({
			width: "64",
			minWidth: "64",
			flexShrink: "0",
		});
		expect(s.name.overflowWrap).toBe("anywhere");
	});

	it("renders escaped complete content on the server with unique labels and deterministic UTC dates", async () => {
		const name = '<img src=x onerror="alert(1)"> & Bracket';
		const fixture = {
			...twoRoundBracket,
			name,
			startsAt: "2026-09-20T16:00:00+02:00",
		};
		const html = await renderToString(
			createSSRApp(
				defineComponent({
					render: () =>
						h("div", [
							h(BracketBoard, { brackets: [fixture] }),
							h(BracketBoard, { brackets: [fixture] }),
						]),
				}),
			),
		);
		expect(html).toContain("&lt;img");
		expect(html).not.toContain("<img");
		expect(html).toContain('datetime="2026-09-20T14:00:00.000Z"');
		expect(html).toContain("14:00 UTC");
		expect(html).toContain("Winner: Fixture Control Plane");
		const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
		expect(new Set(ids).size).toBe(ids.length);
		expect(fetch).not.toHaveBeenCalled();
	});
});
