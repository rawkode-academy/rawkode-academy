/**
 * The homepage statement's rotating topic.
 *
 * The first topic is already in the HTML, so the statement reads in full
 * without script and under reduced motion; this only types the others in
 * after it. It idles while the tab is hidden or the hero is off screen.
 */
const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 2400;
const GAP_MS = 320;

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
			for (let at = label.textContent.length; at > 0; at--) {
				label.textContent = label.textContent.slice(0, at - 1);
				await sleep(DELETE_MS);
			}
			await sleep(GAP_MS);
			index = (index + 1) % topics.length;
			const next: string = topics[index];
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
		caret.remove();
	});

	void run();
}
