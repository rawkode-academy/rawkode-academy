import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN =
	process.env.REALTIMEKIT_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
const WEBHOOK_NAME =
	process.env.REALTIMEKIT_WEBHOOK_NAME ??
	"Rawkode Academy stream notifications";
const WEBHOOK_BASE_URL =
	process.env.REALTIMEKIT_WEBHOOK_BASE_URL ?? "https://rawkode.academy";
const WEBHOOK_URL = new URL(
	"/api/webhooks/realtimekit/stream-started",
	WEBHOOK_BASE_URL,
).href;
const WEBHOOK_EVENTS = ["livestreaming.statusUpdate"];
const WRANGLER_CONFIG_PATH = fileURLToPath(
	new URL("../wrangler.jsonc", import.meta.url),
);

interface CloudflareEnvelope<T> {
	success?: boolean;
	errors?: Array<{ message?: string }>;
	data?: T;
	result?: T;
}

interface RealtimeKitApp {
	id?: string;
	name?: string;
}

interface RealtimeKitWebhook {
	id: string;
	enabled: boolean;
	events: string[];
	name: string;
	url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeArray<T>(value: unknown, key: string): T[] {
	if (Array.isArray(value)) return value as T[];
	if (isRecord(value) && Array.isArray(value[key])) return value[key] as T[];
	return [];
}

function normalizeWebhook(value: unknown): RealtimeKitWebhook {
	const webhook =
		isRecord(value) && isRecord(value.webhook) ? value.webhook : value;
	if (!isRecord(webhook) || typeof webhook.id !== "string") {
		throw new Error("Cloudflare API returned a webhook without an id.");
	}
	return webhook as unknown as RealtimeKitWebhook;
}

function requireValue(value: string | undefined, name: string): string {
	if (value?.trim()) return value.trim();
	throw new Error(`${name} is required.`);
}

async function realtimeKitFetch<T>(
	pathname: string,
	init: RequestInit = {},
): Promise<T> {
	const accountId = requireValue(ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID");
	const apiToken = requireValue(
		API_TOKEN,
		"REALTIMEKIT_API_TOKEN or CLOUDFLARE_API_TOKEN",
	);
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit${pathname}`,
		{
			...init,
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		},
	);
	const body = (await response
		.json()
		.catch(() => ({}))) as CloudflareEnvelope<T>;
	if (!response.ok || body.success === false) {
		const message =
			body.errors
				?.map((error) => error.message)
				.filter(Boolean)
				.join("; ") || `Cloudflare API returned ${response.status}`;
		throw new Error(message);
	}

	const data = body.data ?? body.result;
	if (!data) throw new Error("Cloudflare API returned an empty response.");
	return data;
}

async function getRealtimeKitAppId(): Promise<string> {
	if (process.env.REALTIMEKIT_APP_ID?.trim()) {
		return process.env.REALTIMEKIT_APP_ID.trim();
	}

	const apps = normalizeArray<RealtimeKitApp>(
		await realtimeKitFetch<unknown>("/apps"),
		"apps",
	);
	const appName = process.env.REALTIMEKIT_APP_NAME?.trim();
	const app = appName
		? apps.find((candidate) => candidate.name === appName)
		: apps.length === 1
			? apps[0]
			: undefined;

	if (!app?.id) {
		throw new Error(
			"REALTIMEKIT_APP_ID is required when the account has multiple RealtimeKit apps.",
		);
	}

	return app.id;
}

function persistWebhookId(webhookId: string): void {
	const configuredWebhookId = process.env.REALTIMEKIT_WEBHOOK_ID?.trim();
	if (configuredWebhookId && configuredWebhookId !== webhookId) {
		throw new Error(
			`REALTIMEKIT_WEBHOOK_ID is ${configuredWebhookId}, but synced webhook id is ${webhookId}.`,
		);
	}

	const config = JSON.parse(readFileSync(WRANGLER_CONFIG_PATH, "utf8")) as {
		vars?: Record<string, unknown>;
	};
	config.vars ??= {};
	if (config.vars.REALTIMEKIT_WEBHOOK_ID === webhookId) return;

	config.vars.REALTIMEKIT_WEBHOOK_ID = webhookId;
	writeFileSync(
		WRANGLER_CONFIG_PATH,
		`${JSON.stringify(config, null, "\t")}\n`,
	);
	console.log(`Wrote REALTIMEKIT_WEBHOOK_ID to ${WRANGLER_CONFIG_PATH}`);
}

async function main(): Promise<void> {
	const appId = await getRealtimeKitAppId();
	const webhooks = normalizeArray<RealtimeKitWebhook>(
		await realtimeKitFetch<unknown>(`/${appId}/webhooks`),
		"webhooks",
	);
	const existing =
		webhooks.find((webhook) => webhook.name === WEBHOOK_NAME) ??
		webhooks.find((webhook) => webhook.url === WEBHOOK_URL);
	const body = JSON.stringify({
		enabled: true,
		events: WEBHOOK_EVENTS,
		name: WEBHOOK_NAME,
		url: WEBHOOK_URL,
	});
	const webhook = normalizeWebhook(
		existing
			? await realtimeKitFetch<unknown>(`/${appId}/webhooks/${existing.id}`, {
					method: "PATCH",
					body,
				})
			: await realtimeKitFetch<unknown>(`/${appId}/webhooks`, {
					method: "POST",
					body,
				}),
	);
	persistWebhookId(webhook.id);

	console.log(
		`${existing ? "Updated" : "Created"} RealtimeKit webhook ${webhook.id} -> ${WEBHOOK_URL}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
