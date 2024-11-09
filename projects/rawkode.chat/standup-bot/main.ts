import createZulipClient from "zulip-js";

const zulipConfig = {
	username: Deno.env.get("ZULIP_USERNAME"),
	apiKey: Deno.env.get("ZULIP_API_KEY"),
	realm: Deno.env.get("ZULIP_REALM"),
};

// Daily
Deno.cron("standup-create", "0 3 * * *", async () => {
	const zulip = await createZulipClient(zulipConfig);

	const formattedDate = new Date().toISOString().split('T')[0];

	await zulip.messages.send({
		to: "Standup",
		type: "stream",
		subject: formattedDate,
		content: "Let's **ship one thing every day**. Share your plan, progress, and problems.",
	});
});
