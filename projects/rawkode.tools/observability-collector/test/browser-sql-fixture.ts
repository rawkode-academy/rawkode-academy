// Offline SQL fixture exporter; no credentials or network access.
import { browserCloudEvent } from "../src/web-events";
import sql from "../basin/browser.sql" with { type: "text" };
import { browserQueries } from "../basin/browser-queries";
const now = Date.parse("2026-11-12T12:00:00Z");
const first = browserCloudEvent(
	{
		event_id: "one",
		anonymous_id: "anon-one",
		session_id: "session-one",
		event: "page_view",
		ts_ms: now,
		url: "https://rawkode.academy/watch?utm_source=social&token=secret",
		referrer: "https://example.com/private?token=secret",
		properties: {
			first_touch_utm_source: "first",
			last_touch_utm_campaign: "last",
			password: "secret",
		},
	},
	{
		url_origin: "https://rawkode.academy",
		user_id: "user-one",
		country: "GB",
		continent: "EU",
		user_agent: "Mozilla/5.0 Chrome/130.0",
	},
	now,
)!;
const second = browserCloudEvent(
	{
		event_id: "two",
		anonymous_id: "anon-two",
		session_id: "session-two",
		event: "cta_click",
		ts_ms: now,
		url: "https://rawkode.academy/",
	},
	{
		url_origin: "https://rawkode.academy",
		user_agent: "Mozilla/5.0 Chrome/130.0",
	},
	now,
)!;
console.log(
	JSON.stringify({
		sql,
		queries: browserQueries("2026-11-12", "2026-11-13"),
		events: [
			first,
			first,
			second,
			{ ...first, source: "unrelated", id: "other" },
			{ ...first, schemaversion: 2, id: "future" },
		],
	}),
);
