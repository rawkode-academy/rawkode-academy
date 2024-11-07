import { parseFeed } from "@mikaelporttila/rss";
import turndown from "turndown";
import createZulipClient from "zulip-js";

const zulipConfig = {
	username: Deno.env.get("ZULIP_USERNAME"),
	apiKey: Deno.env.get("ZULIP_API_KEY"),
	realm: Deno.env.get("ZULIP_REALM"),
};

// Hourly
Deno.cron("stack-updates", "* * * * *", async () => {
	const keyValueStore = await Deno.openKv();

	const projectsToFollow = [
		"restatedev/restate",
		"withastro/astro",
		"zitadel/zitadel",
	];

	projectsToFollow.forEach(async (project) => {
		const projectState = await keyValueStore.get<Date>(["state", project]);

		if (projectState.value === null) {
			// Set state to 6 hours ago to avoid fetching all releases
			keyValueStore.set(
				["state", project],
				new Date(Date.now() - 6 * 60 * 60 * 1000),
			);

			// We won't try to fetch this now, let's capture during next schedule
			console.info(
				`Project, ${project}, appears to be new. Scheduled for next fetch.`,
			);
			return;
		}

		const response = await fetch(
			`https://github.com/${project}/releases.atom`,
		);
		const xml = await response.text();
		const feed = await parseFeed(xml);

		if (projectState >= feed.updated) {
			return;
		}

		keyValueStore.set(
			["state", project],
			feed.updated,
		);

		// Let's never spam more than 2 items
		const latestEntries = feed.entries.slice(0, 2);

		const zulip = await createZulipClient(zulipConfig);
		const td = new turndown();

		latestEntries.forEach(async (entry) => {
			if (projectState >= entry.updated) {
				return;
			}

			const markdown = td.turndown(entry.content.value);

			await zulip.messages.send({
				to: "Stack Updates",
				type: "stream",
				subject: project,
				content: `New Release: ${entry.title.value}\n\n${
					entry.links[0].href
				}\n\n\n${markdown}`,
			});
		});
	});
});
