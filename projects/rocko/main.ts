import App from "@slack/bolt";

const KAGENT_A2A_URL = Deno.env.get("KAGENT_A2A_URL");
if (!KAGENT_A2A_URL) {
	throw new Error("KAGENT_A2A_URL environment variable is required");
}

const app = new App.default({
	token: Deno.env.get("SLACK_BOT_TOKEN"),
	appToken: Deno.env.get("SLACK_APP_TOKEN"),
	socketMode: true,
});

interface A2AResponse {
	result?: {
		status: string;
		artifacts?: Array<{
			parts: Array<{ text?: string }>;
		}>;
	};
	error?: {
		message: string;
	};
}

async function sendToAgent(text: string): Promise<string> {
	const response = await fetch(`${KAGENT_A2A_URL}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: crypto.randomUUID(),
			method: "tasks/send",
			params: {
				id: crypto.randomUUID(),
				message: {
					role: "user",
					parts: [{ text }],
				},
			},
		}),
	});

	const data: A2AResponse = await response.json();

	if (data.error) {
		return `Error: ${data.error.message}`;
	}

	const parts = data.result?.artifacts?.flatMap((a) => a.parts) ?? [];
	const text_parts = parts.map((p) => p.text).filter(Boolean);
	return text_parts.join("\n") || "No response from agent.";
}

app.event("app_mention", async ({ event, say }) => {
	const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
	if (!text) {
		await say({ text: "Hey! How can I help?", thread_ts: event.ts });
		return;
	}

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
});

app.event("message", async ({ event, say }) => {
	if (event.channel_type !== "im") return;
	if ("bot_id" in event) return;

	const text = "text" in event ? (event.text ?? "") : "";
	if (!text) return;

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
});

await app.start();
console.log("Rocko is running");
