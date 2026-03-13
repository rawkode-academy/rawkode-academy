import { App, LogLevel, type SlackEventMiddlewareArgs } from "@slack/bolt";

const kagentA2AUrl = Deno.env.get("KAGENT_A2A_URL");
if (!kagentA2AUrl) {
	throw new Error("KAGENT_A2A_URL environment variable is required");
}
const KAGENT_A2A_URL = kagentA2AUrl;
const DEBUG_ENABLED = isDebugEnabled(Deno.env.get("DEBUG"));
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SLACK_APP_TOKEN = Deno.env.get("SLACK_APP_TOKEN");
const REQUIRED_BOT_SCOPES = ["chat:write", "app_mentions:read", "im:history"];

const app = new App({
	token: SLACK_BOT_TOKEN,
	appToken: SLACK_APP_TOKEN,
	socketMode: true,
	logLevel: DEBUG_ENABLED ? LogLevel.DEBUG : LogLevel.INFO,
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

interface SlackAuthTestResponse {
	ok: boolean;
	error?: string;
	team?: string;
	team_id?: string;
	user?: string;
	user_id?: string;
	bot_id?: string;
	url?: string;
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

function parseScopes(headerValue: string | null): string[] {
	if (!headerValue) return [];
	return headerValue
		.split(",")
		.map((scope) => scope.trim())
		.filter(Boolean);
}

async function logSlackConfiguration(): Promise<void> {
	if (!SLACK_BOT_TOKEN) {
		console.error("SLACK_BOT_TOKEN environment variable is required");
		return;
	}

	let response: Response;
	try {
		response = await fetch("https://slack.com/api/auth.test", {
			headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
		});
	} catch (error) {
		console.error("Slack auth.test request failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	let payload: SlackAuthTestResponse;
	try {
		payload = await response.json();
	} catch {
		console.error("Slack auth.test returned invalid JSON");
		return;
	}

	const scopes = parseScopes(response.headers.get("x-oauth-scopes"));
	if (!payload.ok) {
		console.error("Slack auth.test failed", {
			error: payload.error ?? "unknown_error",
			scopes,
		});
		return;
	}

	console.log("Slack auth ok", {
		team: payload.team ?? null,
		teamId: payload.team_id ?? null,
		user: payload.user ?? null,
		userId: payload.user_id ?? null,
		botId: payload.bot_id ?? null,
		scopes,
	});

	const missingScopes = REQUIRED_BOT_SCOPES.filter((scope) => !scopes.includes(scope));
	if (missingScopes.length > 0) {
		console.error("Slack bot token is missing required scopes for mentions/DMs", {
			currentScopes: scopes,
			missingScopes,
		});
	}
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

app.use(async ({ body, next }) => {
	debugLog("Received Slack envelope", {
		type: typeof body === "object" && body !== null && "type" in body ? body.type : null,
		eventType:
			typeof body === "object" &&
			body !== null &&
			"event" in body &&
			typeof body.event === "object" &&
			body.event !== null &&
			"type" in body.event
				? body.event.type
				: null,
	});
	await next();
});

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

await logSlackConfiguration();
await app.start();
debugLog("Debug logging enabled", {
	kagentA2AUrl: KAGENT_A2A_URL,
	socketMode: true,
});
console.log("Rocko is running");
