/**
 * HTTP helpers shared by the audit behaviors: a polite fetch, link
 * classification and bounded parallelism.
 *
 * @module
 */
import type { LinkCheck } from "./technology.ts";

const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const REQUEST_TIMEOUT_MILLISECONDS = 20_000;
const CONCURRENT_REQUESTS = 8;

/** Fetch with a browser-like user agent and a timeout. */
export async function request(
	url: string,
	init: RequestInit = {},
): Promise<Response> {
	return await fetch(url, {
		redirect: "follow",
		...init,
		headers: {
			"user-agent": USER_AGENT,
			accept: "text/html,application/json,*/*",
			...init.headers,
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
	});
}

function classify(status: number): LinkCheck["state"] {
	if (status >= 200 && status < 400) return "ok";
	if (status === 404 || status === 410) return "broken";
	if ([401, 403, 405, 406, 429, 999].includes(status)) return "blocked";
	return "error";
}

/** Request a URL and classify the answer: live, redirected, dead or blocked. */
export async function checkLink(url: string): Promise<LinkCheck> {
	const { hostname, pathname } = new URL(url);
	const host = hostname.replace(/^www\./, "");
	if (host === "twitter.com" || host === "x.com") {
		return { state: "blocked", detail: "X does not answer automated requests" };
	}
	try {
		// An expired Discord invite still serves a page; the invite API says so.
		const invite = host === "discord.gg"
			? pathname.slice(1)
			: host === "discord.com" && pathname.match(/^\/invite\/([^/]+)/)?.[1];
		if (invite) {
			const response = await request(
				`https://discord.com/api/v10/invites/${invite}`,
			);
			await response.body?.cancel();
			return {
				state: classify(response.status),
				status: response.status,
				detail: "Discord invite",
			};
		}
		const response = await request(url);
		await response.body?.cancel();
		const state = classify(response.status);
		if (state !== "ok") return { state, status: response.status };
		// GitHub answers a disabled Discussions tab with a redirect to the repository.
		if (
			host === "github.com" && /\/discussions\/?$/.test(pathname) &&
			!/\/discussions/.test(response.url)
		) {
			return {
				state: "broken",
				status: response.status,
				detail: "Discussions are disabled",
			};
		}
		return response.redirected && response.url !== url
			? { state: "redirected", status: response.status, finalUrl: response.url }
			: { state: "ok", status: response.status };
	} catch (error) {
		// The reason for a failed fetch (for example a DNS error) is on its cause.
		const cause = error instanceof Error ? error.cause : undefined;
		const detail = [error, cause]
			.filter((part) => part !== undefined)
			.map((part) => (part instanceof Error ? part.message : String(part)))
			.join(": ");
		return {
			state: /dns|lookup|not known|ENOTFOUND/i.test(detail)
				? "broken"
				: "error",
			detail,
		};
	}
}

/** Map over items with a bounded number of requests in flight. */
export async function inParallel<T, R>(
	items: T[],
	work: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	await Promise.all(
		Array.from(
			{ length: Math.min(CONCURRENT_REQUESTS, items.length) },
			async () => {
				while (next < items.length) {
					const index = next++;
					results[index] = await work(items[index]);
				}
			},
		),
	);
	return results;
}
