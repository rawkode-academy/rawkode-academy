import { App, type SlackEventMiddlewareArgs } from "@slack/bolt";

const kagentA2AUrl = Deno.env.get("KAGENT_A2A_URL");
if (!kagentA2AUrl) {
	throw new Error("KAGENT_A2A_URL environment variable is required");
}
const KAGENT_A2A_URL = kagentA2AUrl;

const app = new App({
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
	let response: Response;
	try {
		response = await fetch(KAGENT_A2A_URL, {
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
	} catch (err) {
		return `Failed to reach agent: ${err instanceof Error ? err.message : String(err)}`;
	}

	if (!response.ok) {
		return `Agent returned HTTP ${response.status}: ${response.statusText}`;
	}

	let data: A2AResponse;
	try {
		data = await response.json();
	} catch {
		return "Agent returned invalid JSON response.";
	}

	if (data.error) {
		return `Agent error: ${data.error.message}`;
	}

	const parts = data.result?.artifacts?.flatMap((a) => a.parts) ?? [];
	const textParts = parts.map((p) => p.text).filter(Boolean);
	return textParts.join("\n") || "No response from agent.";
}

app.event("app_mention", async ({ event, say }: SlackEventMiddlewareArgs<"app_mention">) => {
	const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
	if (!text) {
		await say({ text: "Hey! How can I help?", thread_ts: event.ts });
		return;
	}

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
});

app.event("message", async ({ event, say }: SlackEventMiddlewareArgs<"message">) => {
	if (event.channel_type !== "im") return;
	if ("bot_id" in event) return;

	const text = "text" in event ? (event.text ?? "") : "";
	if (!text) return;

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
});

await app.start();
console.log("Rocko is running");
