import { schemaFlags, schemaQuery } from "./verify-live-schema";
import {
	checkCloudflareApiSuccess,
	checkCloudflareCollectionHas,
	checkD1DatabaseOutput,
	checkD1SchemaOutput,
	checkDeploymentOutput,
	checkExpectedText,
	checkR2BucketOutput,
	checkRealtimeKitPresetCoverage,
	checkStreamLiveInputs,
	checkWorkerBindings,
	getCloudflareCollection,
	type CheckResult,
	type RealtimeKitAppPresetSummary,
} from "./verify-live-checks";

interface VerificationStep {
	name: string;
	run: () => Promise<CheckResult>;
}

const accountId = "0aeb879de8e3cdde5fb3d413025222ce";
const workerName = "rawkode-academy-studio";
const studioOrigin = "https://rawkode.studio";
const studioDatabaseName = "rawkode-academy-studio";
const studioDatabaseId = "1fe3facd-0c47-43e2-b89d-f402e457db32";
const sessionKvName = "rawkode-academy-sessions";
const sessionKvId = "f3a5e01c10b144f5964d060cefa1b70c";
const recordingsBucketName = "rawkode-academy-content";
const notificationQueueName = "rawkode-academy-notifications";
const realtimeKitSecretStoreId = "492e5e40b9d64ebeac7e7a77db91ff6e";
const realtimeKitPresetNames = [
	"rawkode-studio-host",
	"rawkode-studio-producer",
	"rawkode-studio-guest",
	"rawkode-studio-program",
];
class VerificationFailure extends Error {}

function commandStep(
	name: string,
	command: string[],
	check: (output: string) => CheckResult = () => ({ ok: true }),
): VerificationStep {
	return {
		name,
		run: async () => {
			const proc = Bun.spawn(command, { stderr: "pipe", stdout: "pipe" });
			const [stdout, , exitCode] = await Promise.all([
				new Response(proc.stdout).text(),
				new Response(proc.stderr).text(),
				proc.exited,
			]);
			if (exitCode !== 0) {
				return {
					detail: `Read-only command exited with code ${exitCode}; provider output was suppressed.`,
					ok: false,
				};
			}
			return check(stdout);
		},
	};
}

async function cloudflareGet(path: string): Promise<unknown> {
	const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
	if (!token) {
		throw new VerificationFailure(
			"CLOUDFLARE_API_TOKEN is missing; run through the production cuenv environment.",
		);
	}
	const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		throw new VerificationFailure(
			`Cloudflare read API returned HTTP ${response.status}; response content was suppressed.`,
		);
	}
	const payload = await response.json().catch(() => null);
	const success = checkCloudflareApiSuccess(payload);
	if (!success.ok) {
		throw new VerificationFailure(success.detail ?? "Cloudflare read API failed.");
	}
	return payload;
}

async function checkStudioHealth(): Promise<CheckResult> {
	let pageResponse: Response;
	let authResponse: Response;
	try {
		[pageResponse, authResponse] = await Promise.all([
			fetch(`${studioOrigin}/`, { redirect: "follow" }),
			fetch(`${studioOrigin}/api/auth/me`, { redirect: "manual" }),
		]);
	} catch {
		return { detail: "Studio production routes could not be reached.", ok: false };
	}
	if (pageResponse.status !== 200) {
		return { detail: `Studio root returned HTTP ${pageResponse.status}.`, ok: false };
	}
	if (authResponse.status !== 401) {
		return {
			detail: `Unauthenticated auth probe returned HTTP ${authResponse.status}, expected 401.`,
			ok: false,
		};
	}
	const auth = await authResponse.json().catch(() => null);
	if (!auth || typeof auth !== "object" || (auth as { authenticated?: unknown }).authenticated !== false) {
		return { detail: "Unauthenticated auth probe returned an unexpected body.", ok: false };
	}
	return { ok: true };
}

async function checkProductionBindings(): Promise<CheckResult> {
	const payload = await cloudflareGet(
		`/accounts/${accountId}/workers/scripts/${workerName}/settings`,
	);
	return checkWorkerBindings(payload, [
		{ fields: { namespace_id: sessionKvId }, name: "SESSION", type: "kv_namespace" },
		{ fields: { id: studioDatabaseId }, name: "STUDIO_DB", type: "d1" },
		{
			fields: { bucket_name: recordingsBucketName },
			name: "RECORDINGS",
			type: "r2_bucket",
		},
		{
			fields: { queue_name: notificationQueueName },
			name: "STREAM_NOTIFICATIONS",
			type: "queue",
		},
		{
			fields: {
				secret_name: "REALTIMEKIT_API_TOKEN",
				store_id: realtimeKitSecretStoreId,
			},
			name: "REALTIMEKIT_API_TOKEN",
			type: "secrets_store_secret",
		},
		{
			fields: {
				secret_name: "REALTIMEKIT_APP_ID",
				store_id: realtimeKitSecretStoreId,
			},
			name: "REALTIMEKIT_APP_ID",
			type: "secrets_store_secret",
		},
		{
			fields: {
				secret_name: "CLOUDFLARE_STREAM_API_TOKEN",
				store_id: realtimeKitSecretStoreId,
			},
			name: "CLOUDFLARE_STREAM_API_TOKEN",
			type: "secrets_store_secret",
		},
	]);
}

async function checkNotificationQueue(): Promise<CheckResult> {
	const payload = await cloudflareGet(`/accounts/${accountId}/queues?per_page=100`);
	return checkCloudflareCollectionHas(
		payload,
		"queue_name",
		notificationQueueName,
	);
}

async function checkRealtimeKit(): Promise<CheckResult> {
	const appsPayload = await cloudflareGet(
		`/accounts/${accountId}/realtime/kit/apps?per_page=100`,
	);
	const apps = getCloudflareCollection(appsPayload);
	if (!apps) {
		return { detail: "RealtimeKit app list was not present.", ok: false };
	}

	const summaries: RealtimeKitAppPresetSummary[] = [];
	for (const app of apps) {
		if (!app || typeof app !== "object") continue;
		const appId = (app as { id?: unknown }).id;
		if (typeof appId !== "string" || !appId) continue;
		const presetsPayload = await cloudflareGet(
			`/accounts/${accountId}/realtime/kit/${encodeURIComponent(appId)}/presets?per_page=100`,
		);
		const presets = getCloudflareCollection(presetsPayload);
		if (!presets) {
			return { detail: "RealtimeKit preset list was not present.", ok: false };
		}
		summaries.push({
			appId,
			presetNames: presets.flatMap((preset) => {
				if (!preset || typeof preset !== "object") return [];
				const name = (preset as { name?: unknown }).name;
				return typeof name === "string" ? [name] : [];
			}),
		});
		const coverage = checkRealtimeKitPresetCoverage(summaries, realtimeKitPresetNames);
		if (coverage.ok) return coverage;
	}
	return checkRealtimeKitPresetCoverage(summaries, realtimeKitPresetNames);
}

async function checkStreamAuthentication(): Promise<CheckResult> {
	const payload = await cloudflareGet(
		`/accounts/${accountId}/stream/live_inputs?include_counts=false`,
	);
	return checkStreamLiveInputs(payload);
}

const steps: VerificationStep[] = [
	commandStep("Cloudflare authentication", ["bun", "x", "wrangler", "whoami"]),
	commandStep(
		"Studio Worker deployment metadata",
		[
			"bun",
			"x",
			"wrangler",
			"deployments",
			"status",
			"--config",
			"./wrangler.jsonc",
			"--json",
		],
		checkDeploymentOutput,
	),
	{
		name: "Studio production route and auth health",
		run: checkStudioHealth,
	},
	commandStep(
		"Session KV namespace",
		["bun", "x", "wrangler", "kv", "namespace", "list", "--config", "./wrangler.jsonc"],
		(output) => checkExpectedText(output, [sessionKvName, sessionKvId]),
	),
	commandStep(
		"Studio D1 database",
		["bun", "x", "wrangler", "d1", "list", "--config", "./wrangler.jsonc", "--json"],
		(output) => checkD1DatabaseOutput(output, studioDatabaseName, studioDatabaseId),
	),
	commandStep(
		"Studio D1 migrations, control state, and stream/recording leases",
		[
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			studioDatabaseName,
			"--config",
			"./wrangler.jsonc",
			"--remote",
			"--json",
			"--command",
			schemaQuery,
		],
		(output) => checkD1SchemaOutput(output, schemaFlags),
	),
	commandStep(
		"Content R2 bucket access",
		[
			"bun",
			"x",
			"wrangler",
			"r2",
			"bucket",
			"info",
			recordingsBucketName,
			"--config",
			"./wrangler.jsonc",
			"--json",
		],
		(output) => checkR2BucketOutput(output, recordingsBucketName),
	),
	commandStep(
		"Studio Secrets Store metadata",
		[
			"bun",
			"x",
			"wrangler",
			"secrets-store",
			"secret",
			"list",
			realtimeKitSecretStoreId,
			"--per-page",
			"100",
			"--remote",
		],
		(output) =>
			checkExpectedText(output, [
				"REALTIMEKIT_API_TOKEN",
				"REALTIMEKIT_APP_ID",
				"CLOUDFLARE_STREAM_API_TOKEN",
			]),
	),
	{
		name: "Deployed Worker production bindings",
		run: checkProductionBindings,
	},
	{
		name: "Notification queue visibility",
		run: checkNotificationQueue,
	},
	{
		name: "RealtimeKit app and preset visibility",
		run: checkRealtimeKit,
	},
	{
		name: "Cloudflare Stream read authentication",
		run: checkStreamAuthentication,
	},
];

async function runStep(step: VerificationStep): Promise<boolean> {
	let result: CheckResult;
	try {
		result = await step.run();
	} catch (error) {
		result = {
			detail:
				error instanceof VerificationFailure
					? error.message
					: "Unexpected verifier failure; provider output was suppressed.",
			ok: false,
		};
	}
	if (result.ok) {
		console.log(`PASS ${step.name}`);
		return true;
	}
	console.error(`FAIL ${step.name}`);
	console.error(result.detail ?? "Verification failed without a diagnostic.");
	return false;
}

let passedSteps = 0;
for (const step of steps) {
	if (await runStep(step)) passedSteps += 1;
}

if (passedSteps !== steps.length) {
	console.error(`\n${passedSteps}/${steps.length} live checks passed.`);
	process.exit(1);
}

console.log(`\n${passedSteps}/${steps.length} live checks passed.`);
