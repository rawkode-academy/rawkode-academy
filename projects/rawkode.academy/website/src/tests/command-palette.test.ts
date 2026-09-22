import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import CommandPalette from "../components/command-palette/CommandPalette.vue";

let wrapper: VueWrapper | undefined;
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
const navigation = [{ id: "watch", title: "Watch videos", href: "/watch", category: "Pages" }, { id: "read", title: "All articles", href: "/read", category: "Articles" }];
function input() { return document.querySelector<HTMLInputElement>('input[role="combobox"]')!; }
async function search(value: string) {
	input().value = value;
	input().dispatchEvent(new Event("input", { bubbles: true }));
	await flushPromises();
}
async function open() {
	wrapper = mount(CommandPalette, { props: { returnFocus: () => document.querySelector<HTMLButtonElement>("#opener") }, attachTo: document.body });
	await vi.waitFor(() => expect(input()).not.toBeNull());
	await flushPromises();
}
beforeEach(() => {
	document.body.innerHTML = '<button id="opener">Search</button>';
	vi.mocked(fetch).mockResolvedValue(response(navigation));
});
afterEach(async () => {
	wrapper?.unmount(); wrapper = undefined;
	await flushPromises();
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("Academy command palette", () => {
	it("loads navigation, supports appearance selection, and closes with Escape", async () => {
		await open();
		expect(document.body.textContent).toContain("Watch videos");
		expect(document.body.textContent).toContain("All articles");
		const appearance = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent?.includes("Change appearance"))!;
		appearance.click(); await flushPromises();
		expect(document.body.textContent).toContain("Light mode");
		input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.hasAttribute("hidden")).toBe(true));
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.hasAttribute("hidden")).toBe(false));
	});

	it("does not let an older response replace a newer search", async () => {
		let completeOld!: (response: Response) => void;
		vi.mocked(fetch).mockImplementation(async (url) => {
			if (String(url).includes("q=old")) return new Promise<Response>(resolve => { completeOld = resolve; });
			if (String(url).includes("q=new")) return response([{ id: "new", title: "Newest match", href: "/read/new", type: "article" }]);
			return response(navigation);
		});
		await open(); await search("old");
		await vi.waitFor(() => expect(completeOld).toBeTypeOf("function"));
		await search("new");
		await vi.waitFor(() => expect(document.body.textContent).toContain("Newest match"));
		completeOld(response([{ id: "old", title: "Old match", href: "/read/old", type: "article" }]));
		await flushPromises();
		expect(document.body.textContent).not.toContain("Old match");
		expect(document.body.textContent).toContain("Newest match");
	});

	it("shows search failures with a usable fallback link", async () => {
		vi.mocked(fetch).mockImplementation(async url => String(url).includes("/api/search") ? new Response("Unavailable", { status: 503 }) : response(navigation));
		await open(); await search("kubernetes");
		await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Content search is unavailable"));
		expect(document.querySelector('[role="alert"] a')?.getAttribute("href")).toBe("/search");
	});
});
