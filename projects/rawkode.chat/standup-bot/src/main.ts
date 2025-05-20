import {
	ExecutionContext,
	ScheduledController,
} from "@cloudflare/workers-types";

interface Env {
	ZULIP_USERNAME: string;
	ZULIP_API_KEY: string;
	ZULIP_REALM: string;
}

export default {
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	) {
		const formattedDate = new Date().toISOString().split("T")[0];

		const url = `${env.ZULIP_REALM}/api/v1/messages?type=stream&to=${encodeURIComponent("Standup")}&subject=${encodeURIComponent(formattedDate)}&content=${encodeURIComponent(
			"Let's **ship one thing every day**. Share your plan, progress, and problems."
		)}`;

		const headers = {
			"Content-Type": "application/json",
			Authorization: `Basic ${btoa(`${env.ZULIP_USERNAME}:${env.ZULIP_API_KEY}`)}`,
		};

		const result = await fetch(url, {
			method: "POST",
			headers: headers,
		});

		if (result.status !== 200) {
			console.error("Error sending message:", result.status, result.statusText);
			const responseText = await result.text();
			console.error("Response body:", responseText);
			return;
		}

		const response = await result.json();
		console.log("Message sent successfully:", response);
	},
};
