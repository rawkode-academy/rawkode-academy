/**
 * The watch workbench's measured escape hatch (`academyWatch.bench`).
 *
 * The recipe pins the ink pane by viewport height alone, which assumes a
 * session of ordinary length. This measures the real one: when the session
 * and "more from" do not both fit the first viewport, "more from" goes back
 * to the end of the ink column (`data-pane-flow="more"`); when the session
 * alone does not fit, the pane scrolls with the page (`"all"`). Without
 * script the recipe's tiers stand. Returns a cleanup.
 */
export function fitWatchPane(bench: HTMLElement): () => void {
	const mq = matchMedia("(min-width: 1024px)");
	const hero = bench.querySelector<HTMLElement>("[data-watch-hero]");

	const fit = () => {
		delete bench.dataset.paneFlow;
		if (!mq.matches) return;
		const pane = bench.querySelector<HTMLElement>("[data-watch-pane-sticky]");
		const more = bench.querySelector<HTMLElement>(":scope > [data-watch-more]");
		if (!pane || !hero) return;
		// The first viewport below the site header, wherever the page is scrolled.
		const avail =
			window.innerHeight -
			Math.max(0, bench.getBoundingClientRect().top + window.scrollY);
		const need =
			hero.getBoundingClientRect().bottom - pane.getBoundingClientRect().top;
		if (need + 20 > avail) {
			bench.dataset.paneFlow = "all";
		} else if (
			bench.hasAttribute("data-pin") &&
			more &&
			need + 16 + more.offsetHeight > avail
		) {
			bench.dataset.paneFlow = "more";
		}
	};

	let frame = 0;
	const schedule = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(fit);
	};

	fit();
	void document.fonts?.ready.then(fit);
	mq.addEventListener("change", fit);
	window.addEventListener("resize", schedule);
	// Only the session: the size of "more from" changes with the attribute
	// and observing it would loop.
	const observer =
		hero && typeof ResizeObserver !== "undefined"
			? new ResizeObserver(schedule)
			: null;
	if (hero) observer?.observe(hero);

	return () => {
		cancelAnimationFrame(frame);
		mq.removeEventListener("change", fit);
		window.removeEventListener("resize", schedule);
		observer?.disconnect();
	};
}
