import createZulipClient from "zulip-js";

const zulipConfig = {
	username: Deno.env.get("ZULIP_USERNAME"),
	apiKey: Deno.env.get("ZULIP_API_KEY"),
	realm: Deno.env.get("ZULIP_REALM"),
};

const schedule: Deno.CronSchedule = {
	hour: { exact: 3 }, // 3 AM UTC
	minute: { exact: 0 }, // 0 minutes past the hour
	month: { every: 1 }, // Every month

	dayOfMonth: { every: 1 },

	// https://docs.deno.com/deploy/kv/manual/cron/#day-of-week-numeric-representation
	dayOfWeek: { exact: [2, 3, 4, 5, 6] }, // Monday to Friday
};

// Run daily, Monday to Friday, at 3 AM UTC
Deno.cron("standup-create", schedule, async () => {
	const zulip = await createZulipClient(zulipConfig);

	const formattedDate = new Date().toISOString().split("T")[0];

	await zulip.messages.send({
		to: "Standup",
		type: "stream",
		subject: formattedDate,
		content:
			"Let's **ship one thing every day**. Share your plan, progress, and problems.",
	});
});
