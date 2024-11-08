import turndown from "turndown";
import createZulipClient from "zulip-js";
import { getValueAsDate, storeDate } from "./store.ts";
import { fetchReleaseFeed } from "./feed.ts";

const zulipConfig = {
	username: Deno.env.get("ZULIP_USERNAME"),
	apiKey: Deno.env.get("ZULIP_API_KEY"),
	realm: Deno.env.get("ZULIP_REALM"),
};

// Hourly
Deno.cron("stack-updates", "0 * * * *", async () => {
	const keyValueStore = await Deno.openKv();

	const projectsToFollow = [
		"restatedev/restate",
		"withastro/astro",
		"zitadel/zitadel",
	];

	projectsToFollow.forEach(async (project) => {
		const projectLastUpdated = await getValueAsDate(keyValueStore, project);
		const projectReleaseFeed = await fetchReleaseFeed(project);

		if (!projectReleaseFeed.updateDate) {
			console.error(`We couldn't determine when the release feed for ${project} was last updated. Skipping.`);
			return;
		}

		if (projectLastUpdated >= projectReleaseFeed.updateDate) {
			console.info(`Release feed for ${project} hasn't been updated since our last fetch.  Skipping.`);
			return;
		}

		console.info(`Release feed for ${project} has been updated since our last fetch. Processing.`);

		storeDate(keyValueStore, project, projectReleaseFeed.updateDate);

		const zulip = await createZulipClient(zulipConfig);
		const td = new turndown();

		// Let's never spam more than 2 items
		projectReleaseFeed.entries.slice(0, 2).forEach(async (entry) => {
			if (!entry.updated) {
				console.error(`Release ${entry.title?.value} for ${project} doesn't have an updated date. Skipping.`);
				return;
			}

			if (entry.updated <= projectLastUpdated) {
				console.error(`Release ${entry.title?.value} for ${project} has already been handled. Skipping.`);
				return;
			}

			if (!entry.title) {
				console.error(`Release ${entry.id} for ${project} doesn't have a title. Skipping.`);
				return;
			}

			if (!entry.content) {
				console.error(`Release ${entry.title.value} for ${project} doesn't have any content. Skipping.`);
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
