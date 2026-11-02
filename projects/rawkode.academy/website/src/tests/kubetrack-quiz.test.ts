import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KubeTrackQuiz from "../components/kubetrack/KubeTrackQuiz.vue";
import { storageKey } from "../lib/kubetrack/quiz";
import type { QuizQuestionProps } from "../lib/kubetrack/view-model";

const questions: QuizQuestionProps[] = [
	{
		id: "1.37/q01",
		kind: "single",
		featureSlug: "kep-1710",
		stage: "stable",
		promptHtml: "<p>Which gate graduated?</p>",
		explanationHtml: "<p>SELinuxMount went stable.</p>",
		choices: [
			{ id: "a", text: "SELinuxMount" },
			{ id: "b", text: "Nothing" },
		],
		answerIds: ["a"],
	},
	{
		id: "1.37/q02",
		kind: "multiple",
		featureSlug: "kep-4639",
		stage: "beta",
		promptHtml: "<p>Pick both beta features.</p>",
		explanationHtml: "<p>Both are beta.</p>",
		choices: [
			{ id: "a", text: "One" },
			{ id: "b", text: "Two" },
			{ id: "c", text: "Three" },
		],
		answerIds: ["a", "b"],
	},
	{
		id: "1.37/q03",
		kind: "true_false",
		stage: "alpha",
		promptHtml: "<p>Alpha gates are on by default.</p>",
		explanationHtml: "<p>Alpha gates are off by default.</p>",
		choices: [
			{ id: "a", text: "True" },
			{ id: "b", text: "False" },
		],
		answerIds: ["b"],
	},
];

const VERSION = "2026-11-01T00:00:00.000Z";
const KEY = storageKey("1.37");
let wrapper: VueWrapper | undefined;
const capture = vi.fn();

async function render() {
	wrapper = mount(KubeTrackQuiz, {
		props: {
			releaseId: "1.37",
			version: VERSION,
			questions,
			shareUrl: "https://rawkode.academy/kubetrack/1.37",
		},
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

function choose(text: string) {
	const label = [
		...document.querySelectorAll<HTMLElement>("label.kt-choice"),
	].find((node) => node.textContent?.includes(text));
	if (!label) throw new Error(`no choice ${text}`);
	label.querySelector<HTMLInputElement>("input")!.click();
}

async function check() {
	document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
	await flushPromises();
}

async function next() {
	const button = [
		...document.querySelectorAll<HTMLButtonElement>("button"),
	].find((node) => /Next question|See results/.test(node.textContent ?? ""))!;
	button.click();
	await flushPromises();
}

const events = () => capture.mock.calls.map(([name]) => name);

beforeEach(() => {
	window.localStorage.clear();
	(window as unknown as { posthog: unknown }).posthog = { capture };
});

afterEach(async () => {
	wrapper?.unmount();
	wrapper = undefined;
	await flushPromises();
	document.body.innerHTML = "";
	delete (window as unknown as { posthog?: unknown }).posthog;
	vi.restoreAllMocks();
});

describe("KubeTrack quiz island", () => {
	it("labels each choice group with its prompt and asks for an answer before checking", async () => {
		await render();
		const group = document.querySelector('[role="radiogroup"]')!;
		const prompt = document.getElementById(
			group.getAttribute("aria-labelledby")!,
		);
		expect(prompt?.textContent).toContain("Which gate graduated?");
		await check();
		expect(document.querySelector('[role="alert"]')?.textContent).toContain(
			"Choose an answer first.",
		);
	});

	it("gives feedback, focuses it and links to the card", async () => {
		await render();
		choose("Nothing");
		await check();
		const heading = document.querySelector(".kt-feedback-heading")!;
		expect(heading.textContent).toContain("Not quite");
		expect(document.activeElement).toBe(heading);
		expect(document.body.textContent).toContain("SELinuxMount went stable.");
		expect(
			document.querySelector(".kt-feedback-review")?.getAttribute("href"),
		).toBe("#kep-1710");
		expect(
			document.querySelector('[data-result="missed"]')?.textContent,
		).toContain("Correct answer");
		expect(events()).toEqual([
			"kubetrack_quiz_started",
			"kubetrack_question_answered",
		]);
		expect(capture.mock.calls[1]?.[1]).toMatchObject({
			release: "1.37",
			kep: 1710,
			stage: "stable",
			correct: false,
		});
	});

	it("submits on Enter, moves focus to the next question and announces it", async () => {
		await render();
		choose("SELinuxMount");
		document
			.querySelector(".kt-question-form > div")!
			.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
		await flushPromises();
		expect(
			document.querySelector(".kt-feedback-heading")?.textContent,
		).toContain("Correct");
		await next();
		expect(document.activeElement?.textContent).toContain("Question 2 of 3");
		// Focus reads the heading; the live region does not repeat it.
		for (const region of document.querySelectorAll('[aria-live="polite"]'))
			expect(region.textContent).not.toContain("Question 2 of 3");
		expect(document.querySelector('[role="group"]')).not.toBeNull();
		expect(document.body.textContent).toContain("Choose 2 answers.");
	});

	it("scores, saves state, retries only the missed questions and builds share text", async () => {
		await render();
		choose("SELinuxMount");
		await check();
		await next();
		choose("One");
		await check();
		await next();
		choose("False");
		await check();
		await next();

		expect(
			document.querySelector(".kt-results-heading")?.textContent,
		).toContain("You scored 2 of 3");
		expect(document.body.textContent).toContain("Keep exploring");
		expect(document.activeElement).toBe(
			document.querySelector(".kt-results-heading"),
		);
		expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({
			version: VERSION,
			completed: true,
		});
		expect(events()).toContain("kubetrack_quiz_completed");

		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", {
			value: undefined,
			configurable: true,
		});
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		[...document.querySelectorAll("button")]
			.find((b) => b.textContent?.includes("Share result"))!
			.click();
		await flushPromises();
		expect(writeText).toHaveBeenCalledWith(
			"KubeTrack 1.37 — 2/3\n✓×✓\nhttps://rawkode.academy/kubetrack/1.37",
		);
		expect(
			document.querySelector(".kt-results-share-status")?.textContent,
		).toContain("copied");

		[...document.querySelectorAll("button")]
			.find((b) => b.textContent?.includes("Retry 1 missed"))!
			.click();
		await flushPromises();
		expect(document.activeElement?.textContent).toContain("Question 2 of 3");
		choose("One");
		await flushPromises();
		choose("Two");
		await flushPromises();
		await check();
		expect(
			document.querySelector(".kt-feedback-heading")?.textContent,
		).toContain("Correct");
		await next();
		expect(
			document.querySelector(".kt-results-heading")?.textContent,
		).toContain("You scored 3 of 3");
		expect(document.body.textContent).toContain("Every answer correct.");
	});

	it("restores saved progress and discards state from another version", async () => {
		window.localStorage.setItem(
			KEY,
			JSON.stringify({
				version: VERSION,
				answers: { "1.37/q01": ["a"] },
				index: 1,
				attempt: 1,
				completed: false,
			}),
		);
		await render();
		expect(
			document.querySelector(".kt-question-heading")?.textContent,
		).toContain("Question 2 of 3");
		expect(document.body.textContent).toContain("1 of 3 answered");
		wrapper?.unmount();
		document.body.innerHTML = "";

		window.localStorage.setItem(
			KEY,
			JSON.stringify({
				version: "old",
				answers: { "1.37/q01": ["a"] },
				index: 1,
				attempt: 1,
				completed: false,
			}),
		);
		await render();
		expect(
			document.querySelector(".kt-question-heading")?.textContent,
		).toContain("Question 1 of 3");
	});

	it("keeps working when storage is blocked", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("denied");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("denied");
		});
		await render();
		choose("SELinuxMount");
		await check();
		expect(
			document.querySelector(".kt-feedback-heading")?.textContent,
		).toContain("Correct");
	});
});
