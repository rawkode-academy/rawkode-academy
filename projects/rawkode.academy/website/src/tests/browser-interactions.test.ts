import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const flush = vi.fn();
vi.mock("@/lib/analytics/track", () => ({
	track: (...args: unknown[]) => track(...args),
	flush: (...args: unknown[]) => flush(...args),
}));

const {
	clickDetails,
	exceptionDetails,
	installClickTracking,
	installExceptionTracking,
	installPageLeaveTracking,
} = await import("@/lib/analytics/interactions");

const events = (name: string) =>
	track.mock.calls
		.filter(([event]) => event === name)
		.map(([, props]) => props);

function click(element: Element, init: MouseEventInit = {}) {
	element.dispatchEvent(
		new MouseEvent("click", { bubbles: true, button: 0, ...init }),
	);
}

let cleanup: Array<() => void> = [];

beforeEach(() => {
	vi.useFakeTimers();
	track.mockReset();
	flush.mockReset();
	document.body.innerHTML = "";
	sessionStorage.clear();
});

afterEach(() => {
	for (const stop of cleanup) stop();
	cleanup = [];
	vi.useRealTimers();
});

describe("clickDetails", () => {
	it("keeps the tag, data-attr, a same-site path and a short label", () => {
		document.body.innerHTML = `<a href="/watch/example?token=secret#t" data-attr="hero-cta">  Watch   the ${"long ".repeat(40)}</a>`;
		const details = clickDetails(document.querySelector("a") as Element);
		expect(details).toMatchObject({
			tag: "a",
			data_attr: "hero-cta",
			href: "/watch/example",
		});
		expect(details.text?.length).toBeLessThanOrEqual(100);
		expect(details.text?.startsWith("Watch the long")).toBe(true);
		expect(JSON.stringify(details)).not.toContain("secret");
	});

	it("keeps origin and path for external links", () => {
		document.body.innerHTML = `<a href="https://example.com/a/b?x=1">Out</a>`;
		expect(clickDetails(document.querySelector("a") as Element).href).toBe(
			"https://example.com/a/b",
		);
	});

	it("never reads the value of a form control", () => {
		document.body.innerHTML = `<input type="submit" value="my@email.com" aria-label="Subscribe">`;
		const details = clickDetails(document.querySelector("input") as Element);
		expect(details).toEqual({ tag: "input", text: "Subscribe" });
	});
});

describe("click tracking", () => {
	it("tracks clicks on interactive elements, not on plain text", () => {
		cleanup.push(installClickTracking());
		document.body.innerHTML = `<p>text</p><button data-attr="save"><span>Save</span></button>`;
		click(document.querySelector("p") as Element);
		click(document.querySelector("span") as Element);
		expect(events("click")).toEqual([
			{ tag: "button", data_attr: "save", text: "Save" },
		]);
	});

	it("reports one rage click for three clicks within a second", () => {
		cleanup.push(installClickTracking());
		document.body.innerHTML = `<button>Go</button>`;
		const button = document.querySelector("button") as Element;
		for (let i = 0; i < 5; i++) {
			click(button);
			vi.advanceTimersByTime(100);
		}
		expect(events("rage_click")).toHaveLength(1);
	});

	it("reports a dead click when nothing changes within a second", () => {
		cleanup.push(installClickTracking());
		document.body.innerHTML = `<button>Nothing</button>`;
		click(document.querySelector("button") as Element);
		vi.advanceTimersByTime(1_000);
		expect(events("dead_click")).toEqual([{ tag: "button", text: "Nothing" }]);
	});

	it("does not report a dead click when the DOM changes", async () => {
		cleanup.push(installClickTracking());
		document.body.innerHTML = `<button>Open</button>`;
		const button = document.querySelector("button") as Element;
		button.addEventListener("click", () => {
			document.body.appendChild(document.createElement("dialog"));
		});
		click(button);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(events("dead_click")).toEqual([]);
	});

	it("ignores clicks that open a new tab", () => {
		cleanup.push(installClickTracking());
		document.body.innerHTML = `<a href="/x" target="_blank">x</a>`;
		click(document.querySelector("a") as Element);
		vi.advanceTimersByTime(1_000);
		expect(events("dead_click")).toEqual([]);
		expect(events("click")).toHaveLength(1);
	});
});

describe("page leave", () => {
	it("sends one page_leave with time on page and scroll depth, then flushes", () => {
		cleanup.push(installPageLeaveTracking());
		dispatchEvent(new Event("pagehide"));
		dispatchEvent(new Event("pagehide"));
		const leaves = events("page_leave");
		expect(leaves).toHaveLength(1);
		expect(leaves[0]).toMatchObject({
			time_on_page_ms: expect.any(Number),
			max_scroll_pct: expect.any(Number),
		});
		expect(flush).toHaveBeenCalledWith(true);
	});
});

describe("exceptions", () => {
	it("keeps type, message, a 4 KB stack and the source", () => {
		const error = new TypeError("boom");
		error.stack = "s".repeat(10_000);
		const details = exceptionDetails(error, "", "onerror");
		expect(details).toMatchObject({
			type: "TypeError",
			message: "boom",
			source: "onerror",
		});
		expect(details.stack).toHaveLength(4096);
	});

	it("reports each message once and at most five per page", () => {
		cleanup.push(installExceptionTracking());
		for (let i = 0; i < 3; i++)
			dispatchEvent(
				new ErrorEvent("error", { error: new Error("same"), message: "same" }),
			);
		for (let i = 0; i < 10; i++)
			dispatchEvent(
				new ErrorEvent("error", {
					error: new Error(`e${i}`),
					message: `e${i}`,
				}),
			);
		expect(events("exception")).toHaveLength(5);
	});

	it("ignores opaque cross-origin script errors", () => {
		cleanup.push(installExceptionTracking());
		dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
		expect(events("exception")).toEqual([]);
	});
});
