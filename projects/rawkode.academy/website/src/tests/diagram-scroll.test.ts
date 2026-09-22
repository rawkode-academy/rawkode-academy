import { afterEach, expect, it, vi } from "vitest";
import { readComponentScript } from "./helpers/component-script";

const code = await readComponentScript("src/components/articles/Diagram.astro");

afterEach(() => {
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

it("centres the controlled expanded diagram without moving focus, then resets the fitted view", () => {
	document.body.innerHTML =
		'<input type="checkbox" data-diagram-toggle aria-controls="diagram"><div id="diagram" tabindex="0"></div><div id="other"></div>';
	const toggle = document.querySelector<HTMLInputElement>("input")!;
	const viewport = document.getElementById("diagram")!;
	const scroll = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});
	const other = vi.spyOn(document.getElementById("other")!, "scrollTo");
	Object.defineProperties(viewport, {
		scrollWidth: { configurable: true, value: 1280 },
		clientWidth: { configurable: true, value: 350 },
	});
	new Function("document", code)(document);
	toggle.focus();
	toggle.checked = true;
	toggle.dispatchEvent(new Event("change"));
	expect(scroll).toHaveBeenLastCalledWith({
		left: 465,
		top: 0,
		behavior: "instant",
	});
	expect(document.activeElement).toBe(toggle);
	expect(other).not.toHaveBeenCalled();
	toggle.checked = false;
	toggle.dispatchEvent(new Event("change"));
	expect(scroll).toHaveBeenLastCalledWith({
		left: 0,
		top: 0,
		behavior: "instant",
	});
});

it("does not fail when a diagram target is absent", () => {
	document.body.innerHTML =
		'<input type="checkbox" data-diagram-toggle aria-controls="missing">';
	new Function("document", code)(document);
	expect(() =>
		document.querySelector("input")!.dispatchEvent(new Event("change")),
	).not.toThrow();
});
