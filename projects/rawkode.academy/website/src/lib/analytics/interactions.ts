// Browser signals PostHog's SDK collected on its own: clicks, dead and rage
// clicks, page leave and uncaught exceptions. They go to Basin only, through
// track(); none of them carry input values, form contents or query strings.

import { flush, track } from "@/lib/analytics/track";

const INTERACTIVE =
	"a[href], button, [data-attr], [role='button'], [role='link'], input[type='submit'], input[type='button'], summary";
const TEXT_LIMIT = 100;
const DEAD_CLICK_MS = 1_000;
const RAGE_WINDOW_MS = 1_000;
const RAGE_CLICKS = 3;
const STACK_LIMIT = 4_096;
const EXCEPTIONS_PER_PAGE = 5;
const EXCEPTIONS_PER_SESSION = 20;
const EXCEPTION_COUNT_KEY = "rk_exc";

export interface ClickDetails {
	tag: string;
	data_attr?: string;
	href?: string;
	text?: string;
}

/** The element a click is about: the nearest interactive ancestor, if any. */
function interactiveTarget(target: EventTarget | null): Element | undefined {
	return target instanceof Element
		? (target.closest(INTERACTIVE) ?? undefined)
		: undefined;
}

/** Path only for same-site links; origin and path for external ones. */
function linkHref(element: Element): string | undefined {
	const raw = element.getAttribute("href");
	if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw))
		return undefined;
	try {
		const url = new URL(raw, location.href);
		if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
		return url.origin === location.origin
			? url.pathname
			: `${url.origin}${url.pathname}`;
	} catch {
		return undefined;
	}
}

export function clickDetails(element: Element): ClickDetails {
	const tag = element.tagName.toLowerCase();
	const dataAttr = element.getAttribute("data-attr") ?? undefined;
	const href = linkHref(element);
	// Never read the value of a form control: only its visible label.
	const isField = tag === "input" || tag === "textarea" || tag === "select";
	const label = isField
		? element.getAttribute("aria-label")
		: (element.getAttribute("aria-label") ??
			(element as HTMLElement).innerText ??
			element.textContent);
	const text = label?.replace(/\s+/g, " ").trim().slice(0, TEXT_LIMIT);
	return {
		tag,
		...(dataAttr ? { data_attr: dataAttr.slice(0, 128) } : {}),
		...(href ? { href } : {}),
		...(text ? { text } : {}),
	};
}

function opensElsewhere(event: MouseEvent, element: Element | undefined) {
	return (
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.button !== 0 ||
		element?.getAttribute("target") === "_blank" ||
		element?.hasAttribute("download") === true
	);
}

/**
 * `web.click` for links, buttons and `data-attr` elements; `web.rage_click`
 * for three clicks within a second on one element; `web.dead_click` when a
 * click is followed by no navigation, DOM change or scroll within a second.
 */
export function installClickTracking(): () => void {
	let rage:
		| { element: Element; times: number[]; reported: boolean }
		| undefined;

	const onClick = (event: MouseEvent) => {
		const interactive = interactiveTarget(event.target);
		const element =
			interactive ??
			(event.target instanceof Element ? event.target : undefined);
		if (!element) return;
		const details = clickDetails(element);

		if (interactive) track("click", details);

		const now = performance.now();
		if (rage?.element !== element) {
			rage = { element, times: [], reported: false };
		}
		rage.times = [...rage.times, now].filter(
			(time) => now - time <= RAGE_WINDOW_MS,
		);
		if (rage.times.length >= RAGE_CLICKS && !rage.reported) {
			rage.reported = true;
			track("rage_click", details);
		} else if (rage.times.length < RAGE_CLICKS) {
			rage.reported = false;
		}

		if (opensElsewhere(event, interactive)) return;
		watchForDeadClick(details);
	};

	document.addEventListener("click", onClick, { capture: true });
	return () =>
		document.removeEventListener("click", onClick, { capture: true });
}

function watchForDeadClick(details: ClickDetails): void {
	const startUrl = location.href;
	let changed = false;
	const markChanged = () => {
		changed = true;
	};
	const observer = new MutationObserver(markChanged);
	observer.observe(document.documentElement, {
		subtree: true,
		childList: true,
		attributes: true,
		characterData: true,
	});
	addEventListener("scroll", markChanged, { capture: true, passive: true });
	addEventListener("pagehide", markChanged);
	setTimeout(() => {
		// Mutations whose callback hasn't run yet still count.
		if (observer.takeRecords().length > 0) changed = true;
		observer.disconnect();
		removeEventListener("scroll", markChanged, { capture: true });
		removeEventListener("pagehide", markChanged);
		const selected = getSelection()?.toString() ?? "";
		if (
			changed ||
			location.href !== startUrl ||
			document.visibilityState === "hidden" ||
			selected.length > 0
		)
			return;
		track("dead_click", details);
	}, DEAD_CLICK_MS);
}

/**
 * One `web.page_leave` per page load, when the page is hidden or unloaded,
 * with the time since navigation started and the deepest scroll reached.
 */
export function installPageLeaveTracking(): () => void {
	let maxScroll = 0;
	let sent = false;
	let frame = 0;

	const measure = () => {
		frame = 0;
		const root = document.documentElement;
		const scrollable = root.scrollHeight - innerHeight;
		const pct =
			scrollable <= 0 ? 100 : Math.round((scrollY / scrollable) * 100);
		maxScroll = Math.max(maxScroll, Math.min(100, Math.max(0, pct)));
	};
	const onScroll = () => {
		if (!frame) frame = requestAnimationFrame(measure);
	};
	const leave = () => {
		if (sent) return;
		sent = true;
		measure();
		track("page_leave", {
			time_on_page_ms: Math.round(performance.now()),
			max_scroll_pct: maxScroll,
		});
		flush(true);
	};
	const onVisibility = () => {
		if (document.visibilityState === "hidden") leave();
	};

	measure();
	addEventListener("scroll", onScroll, { passive: true });
	addEventListener("pagehide", leave);
	document.addEventListener("visibilitychange", onVisibility);
	return () => {
		removeEventListener("scroll", onScroll);
		removeEventListener("pagehide", leave);
		document.removeEventListener("visibilitychange", onVisibility);
		if (frame) cancelAnimationFrame(frame);
	};
}

function sessionExceptionCount(increment: boolean): number {
	try {
		const count = Number(sessionStorage.getItem(EXCEPTION_COUNT_KEY) ?? 0) || 0;
		if (increment)
			sessionStorage.setItem(EXCEPTION_COUNT_KEY, String(count + 1));
		return count;
	} catch {
		return 0;
	}
}

export function exceptionDetails(
	error: unknown,
	fallbackMessage: string,
	source: "onerror" | "unhandledrejection",
): Record<string, string> {
	const isError = error instanceof Error;
	const message =
		(isError ? error.message : fallbackMessage) || "Unknown error";
	return {
		type: isError
			? error.name
			: typeof error === "string"
				? "Error"
				: "Unknown",
		message: message.slice(0, 512),
		...(isError && error.stack
			? { stack: error.stack.slice(0, STACK_LIMIT) }
			: {}),
		source,
	};
}

/**
 * `web.exception` for uncaught errors and unhandled rejections. At most five
 * per page and twenty per session, and the same message only once per page.
 * The collector strips query strings, emails and credentials from the text.
 */
export function installExceptionTracking(): () => void {
	let pageCount = 0;
	const seen = new Set<string>();

	const report = (details: Record<string, string>) => {
		const key = `${details.type}:${details.message}`;
		if (seen.has(key) || pageCount >= EXCEPTIONS_PER_PAGE) return;
		if (sessionExceptionCount(false) >= EXCEPTIONS_PER_SESSION) return;
		seen.add(key);
		pageCount++;
		sessionExceptionCount(true);
		track("exception", details);
	};
	const onError = (event: ErrorEvent) => {
		// Cross-origin scripts report only "Script error." with no details.
		if (!event.error && /^script error\.?$/i.test(event.message)) return;
		report(exceptionDetails(event.error, event.message, "onerror"));
	};
	const onRejection = (event: PromiseRejectionEvent) => {
		const reason = event.reason;
		report(
			exceptionDetails(
				reason,
				typeof reason === "string" ? reason : "Unhandled promise rejection",
				"unhandledrejection",
			),
		);
	};

	addEventListener("error", onError);
	addEventListener("unhandledrejection", onRejection);
	return () => {
		removeEventListener("error", onError);
		removeEventListener("unhandledrejection", onRejection);
	};
}
