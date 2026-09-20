import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
	"src/components/organizations/ContactFallback.astro",
	"utf8",
);
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("Contact copy script missing");
const code = ts.transpileModule(script, {
	compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

const copy = vi.fn();
const legacyCopy = vi.fn();
const legacyDescriptor = Object.getOwnPropertyDescriptor(
	document,
	"execCommand",
);

async function clickCopy() {
	const button = document.querySelector<HTMLButtonElement>("button")!;
	button.focus();
	button.click();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	return button;
}

beforeEach(() => {
	vi.useFakeTimers();
	copy.mockReset().mockResolvedValue(undefined);
	legacyCopy.mockReset().mockReturnValue(true);
	Object.defineProperty(document, "execCommand", {
		configurable: true,
		value: legacyCopy,
	});
	// Only DOM and clipboard boundaries are fixtures; execute the component's real script.
	document.body.innerHTML = `<aside class="contact-fallback">
		<button data-copy-text="david@rawkode.academy" data-copy-kind="Email address" class="contact-fallback__copy">Copy email</button>
		<p role="status" data-copy-status></p>
	</aside><aside class="contact-fallback"><p role="status" data-copy-status>Unchanged</p></aside>`;
	new Function("document", "navigator", "window", "HTMLElement", code)(
		document,
		{ clipboard: { writeText: copy } },
		window,
		HTMLElement,
	);
});

afterEach(() => {
	document.body.innerHTML = "";
	if (legacyDescriptor)
		Object.defineProperty(document, "execCommand", legacyDescriptor);
	else Reflect.deleteProperty(document, "execCommand");
	vi.useRealTimers();
});

describe("Contact copy feedback", () => {
	it("announces a successful copy only in its panel and resets the button label", async () => {
		const button = await clickCopy();
		expect(copy).toHaveBeenCalledWith("david@rawkode.academy");
		expect(button.textContent).toBe("Copied");
		expect(document.querySelector("[data-copy-status]")?.textContent).toBe(
			"Email address copied to clipboard.",
		);
		expect(
			document.querySelectorAll("[data-copy-status]")[1]?.textContent,
		).toBe("Unchanged");
		expect(document.activeElement).toBe(button);
		vi.advanceTimersByTime(2000);
		expect(button.textContent).toBe("Copy email");
	});

	it("falls back to native copying without leaving focus in a removed textarea", async () => {
		copy.mockRejectedValue(new Error("Clipboard unavailable"));
		const button = await clickCopy();
		expect(legacyCopy).toHaveBeenCalledWith("copy");
		expect(document.querySelector("textarea")).toBeNull();
		expect(document.activeElement).toBe(button);
		expect(button.textContent).toBe("Copied");
	});

	it("offers manual recovery when both copy methods fail", async () => {
		copy.mockRejectedValue(new Error("Clipboard unavailable"));
		legacyCopy.mockReturnValue(false);
		const button = await clickCopy();
		expect(button.textContent).toBe("Copy failed");
		expect(document.querySelector("[data-copy-status]")?.textContent).toBe(
			"Copy failed. Select and copy the text shown above.",
		);
		expect(document.activeElement).toBe(button);
	});

	it("supplies a persistent polite announcement region and contextual copy names", () => {
		expect(source).toMatch(
			/role="status" aria-live="polite" aria-atomic="true"[^>]*data-copy-status/,
		);
		expect(source).toContain('data-copy-kind="Email address"');
		expect(source).toContain('data-copy-kind="Template"');
	});
});
