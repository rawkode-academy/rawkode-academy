/**
 * The homepage statement's rotating topic.
 *
 * The first topic is already in the HTML, so the statement reads in full
 * without script and under reduced motion; this only types the others in
 * after it, each one selected and typed over like a word in an editor. It
 * idles while the tab is hidden or the hero is off screen.
 */
const TYPE_MS = 55;
const HOLD_MS = 2400;
/** The selection sweeps across the topic, then holds for a beat. */
const SELECT_MS = 520;
const GAP_MS = 180;

export function mountTypewriter(target: HTMLElement) {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	const topics: unknown = JSON.parse(target.dataset.topics ?? "[]");
	if (
		reduced.matches ||
		!Array.isArray(topics) ||
		topics.length < 2 ||
		!topics.every((topic) => typeof topic === "string")
	)
		return;

	const label = document.createElement("span");
	label.dataset.label = "";
	const caret = document.createElement("span");
	caret.dataset.caret = "";
	caret.setAttribute("aria-hidden", "true");
	label.textContent = target.textContent;
	target.replaceChildren(label, caret);

	let index = 0;
	let visible = true;
	let timer: number | undefined;

	const sleep = (ms: number) =>
		new Promise<void>((resolve) => {
			timer = window.setTimeout(resolve, ms);
		});
	// Waits until the hero is on screen and the tab is in front.
	const attended = async () => {
		while (!visible || document.hidden || reduced.matches) await sleep(400);
	};

	const run = async () => {
		while (true) {
			await sleep(HOLD_MS);
			await attended();
			// Replace it as an editor would: select the word, then type over it.
			label.dataset.selected = "";
			await sleep(SELECT_MS);
			label.textContent = "";
			delete label.dataset.selected;
			await sleep(GAP_MS);
			index = (index + 1) % topics.length;
			const next = topics[index] ?? "";
			for (let at = 1; at <= next.length; at++) {
				label.textContent = next.slice(0, at);
				await sleep(TYPE_MS);
			}
		}
	};

	new IntersectionObserver(([entry]) => {
		visible = entry?.isIntersecting ?? true;
	}).observe(target);

	// Reduced motion switched on mid-visit: put the first topic back and stop.
	reduced.addEventListener("change", () => {
		if (!reduced.matches) return;
		window.clearTimeout(timer);
		label.textContent = String(topics[0]);
		delete label.dataset.selected;
		caret.remove();
	});

	void run();
}
