import { App, type SlackEventMiddlewareArgs } from "@slack/bolt";

const kagentA2AUrl = Deno.env.get("KAGENT_A2A_URL");
if (!kagentA2AUrl) {
	throw new Error("KAGENT_A2A_URL environment variable is required");
}
const KAGENT_A2A_URL = kagentA2AUrl;
const DEBUG_ENABLED = isDebugEnabled(Deno.env.get("DEBUG"));

const app = new App({
	token: Deno.env.get("SLACK_BOT_TOKEN"),
	appToken: Deno.env.get("SLACK_APP_TOKEN"),
	socketMode: true,
});

interface A2AResponse {
	result?: {
		status?: {
			state?: string;
		};
		artifacts?: Array<{
			parts: Array<{ kind?: string; text?: string }>;
		}>;
	};
	error?: {
		message: string;
	};
}

function isDebugEnabled(value: string | undefined): boolean {
	if (!value) return false;
	return !["0", "false", "off", "no"].includes(value.toLowerCase());
}

function truncate(text: string, maxLength = 200): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
}

function debugLog(message: string, details?: Record<string, unknown>): void {
	if (!DEBUG_ENABLED) return;

	if (!details) {
		console.log(`[debug] ${message}`);
		return;
	}

	console.log(`[debug] ${message} ${JSON.stringify(details)}`);
}

async function sendToAgent(text: string): Promise<string> {
	const requestId = crypto.randomUUID();
	debugLog("Sending request to Kagent", {
		requestId,
		text: truncate(text),
	});

	let response: Response;
	try {
		response = await fetch(KAGENT_A2A_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: requestId,
				method: "message/send",
				params: {
					message: {
						role: "user",
						parts: [{ kind: "text", text }],
					},
				},
			}),
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		debugLog("Failed to reach Kagent", { requestId, error });
		return `Failed to reach agent: ${error}`;
	}

	debugLog("Kagent HTTP response received", {
		requestId,
		status: response.status,
		statusText: response.statusText,
	});

	if (!response.ok) {
		return `Agent returned HTTP ${response.status}: ${response.statusText}`;
	}

	let data: A2AResponse;
	try {
		data = await response.json();
	} catch {
		debugLog("Kagent returned invalid JSON", { requestId });
		return "Agent returned invalid JSON response.";
	}

	if (data.error) {
		debugLog("Kagent returned an application error", {
			requestId,
			error: data.error.message,
		});
		return `Agent error: ${data.error.message}`;
	}

	const parts = data.result?.artifacts?.flatMap((a) => a.parts) ?? [];
	const textParts = parts.map((p) => p.text).filter(Boolean);
	const reply = textParts.join("\n") || "No response from agent.";
	debugLog("Kagent reply ready", {
		requestId,
		status: data.result?.status?.state ?? null,
		reply: truncate(reply),
	});
	return reply;
}

app.event("app_mention", async ({ event, say }: SlackEventMiddlewareArgs<"app_mention">) => {
	const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
	debugLog("Received Slack app mention", {
		channel: event.channel,
		threadTs: event.thread_ts ?? null,
		ts: event.ts,
		user: event.user,
		text: truncate(text),
	});

	if (!text) {
		await say({ text: "Hey! How can I help?", thread_ts: event.ts });
		debugLog("Sent empty app mention prompt", {
			channel: event.channel,
			threadTs: event.ts,
		});
		return;
	}

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
	debugLog("Sent Slack reply for app mention", {
		channel: event.channel,
		threadTs: event.ts,
		reply: truncate(reply),
	});
});

app.event("message", async ({ event, say }: SlackEventMiddlewareArgs<"message">) => {
	if (event.channel_type !== "im") {
		debugLog("Ignored non-DM Slack message", {
			channel: event.channel,
			channelType: event.channel_type,
			ts: event.ts,
		});
		return;
	}

	if ("bot_id" in event) {
		debugLog("Ignored bot-authored Slack DM", {
			botId: event.bot_id,
			channel: event.channel,
			ts: event.ts,
		});
		return;
	}

	const text = "text" in event ? (event.text ?? "") : "";
	debugLog("Received Slack DM", {
		channel: event.channel,
		ts: event.ts,
		user: "user" in event ? event.user : null,
		text: truncate(text),
	});

	if (!text) {
		debugLog("Ignored empty Slack DM", {
			channel: event.channel,
			ts: event.ts,
		});
		return;
	}

	const reply = await sendToAgent(text);
	await say({ text: reply, thread_ts: event.ts });
	debugLog("Sent Slack reply for DM", {
		channel: event.channel,
		threadTs: event.ts,
		reply: truncate(reply),
	});
});

app.error(async (error) => {
	console.error("Slack app error", error);
});

await app.start();
debugLog("Debug logging enabled", {
	kagentA2AUrl: KAGENT_A2A_URL,
	socketMode: true,
});
console.log("Rocko is running");
