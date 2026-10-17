import {
	formatLocal,
	LOCAL_TIME_ATTRIBUTE,
	type LocalTimeSpec,
} from "@/lib/local-time";

const SELECTOR = `[${LOCAL_TIME_ATTRIBUTE}]`;

const instantOf = (element: Element) =>
	element.getAttribute("datetime") ?? element.getAttribute("data-datetime");

/** Re-format server-rendered UTC dates in the browser's time zone. */
export function localiseTimes(root: ParentNode = document) {
	for (const element of root.querySelectorAll<HTMLElement>(SELECTOR)) {
		const instant = instantOf(element);
		const raw = element.getAttribute(LOCAL_TIME_ATTRIBUTE);
		if (!instant || !raw) continue;
		const date = new Date(instant);
		if (Number.isNaN(date.getTime())) continue;
		try {
			const spec = JSON.parse(raw) as LocalTimeSpec;
			const text = formatLocal(date, spec.options, spec.locale);
			if (element.textContent !== text) element.textContent = text;
		} catch {
			// Keep the server-rendered UTC fallback.
		}
	}
}
