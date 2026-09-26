import type { StudioRecordingReadyMarker } from "./contracts.js";

export interface GoogleServiceAccount {
	client_email: string;
	private_key: string;
	token_uri?: string;
}

export interface CloudRunConfig {
	jobName: string;
	location: string;
	projectId: string;
	serviceAccount: GoogleServiceAccount;
}

interface CloudRunEnvVar {
	name?: string;
	value?: string;
}

interface CloudRunExecution {
	name?: string;
	template?: {
		containers?: Array<{ env?: CloudRunEnvVar[] }>;
	};
}

interface CloudRunExecutionList {
	executions?: CloudRunExecution[];
	nextPageToken?: string;
}

export interface RunTranscodingJobOptions {
	accessToken?: string;
	allowCreate?: boolean;
	dispatchToken?: string;
	fetch?: typeof fetch;
	reconcileAttempts?: number;
	reconcileDelayMs?: number;
	retryAfterSeconds?: number;
}

export class CloudRunDispatchPendingError extends Error {
	readonly retryAfterSeconds: number;

	constructor(message: string, retryAfterSeconds: number, cause?: unknown) {
		super(message, { cause });
		this.name = "CloudRunDispatchPendingError";
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

export function requireCloudRunOperationName(operation: {
	name?: string;
}): string {
	if (!operation.name) {
		throw new Error("Cloud Run jobs.run returned no operation name");
	}
	return operation.name;
}

function bytesToHex(bytes: Uint8Array): string {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createStudioDispatchToken(
	marker: StudioRecordingReadyMarker,
): Promise<string> {
	const identity = JSON.stringify([
		marker.videoId,
		marker.studioSessionId,
		marker.recordingId,
		marker.sourceBucket,
		marker.sourceKey,
		marker.sourceEtag,
		marker.sourceFormat,
		marker.outputPrefix,
	]);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(identity),
	);
	return `studio-${bytesToHex(new Uint8Array(digest))}`;
}

function executionEnvironment(
	execution: CloudRunExecution,
): Map<string, string> {
	const values = new Map<string, string>();
	for (const container of execution.template?.containers ?? []) {
		for (const variable of container.env ?? []) {
			if (variable.name && typeof variable.value === "string") {
				values.set(variable.name, variable.value);
			}
		}
	}
	return values;
}

function executionMatchesMarker(
	execution: CloudRunExecution,
	marker: StudioRecordingReadyMarker,
	dispatchToken: string,
): boolean {
	const environment = executionEnvironment(execution);
	return (
		environment.get("STUDIO_DISPATCH_TOKEN") === dispatchToken &&
		environment.get("VIDEO_ID") === marker.videoId &&
		environment.get("STUDIO_SESSION_ID") === marker.studioSessionId &&
		environment.get("RECORDING_ID") === marker.recordingId &&
		environment.get("SOURCE_BUCKET") === marker.sourceBucket &&
		environment.get("SOURCE_KEY") === marker.sourceKey &&
		environment.get("SOURCE_ETAG") === marker.sourceEtag &&
		environment.get("SOURCE_FORMAT") === marker.sourceFormat &&
		environment.get("OUTPUT_PREFIX") === marker.outputPrefix
	);
}

function jobResourceName(config: CloudRunConfig): string {
	return `projects/${config.projectId}/locations/${config.location}/jobs/${config.jobName}`;
}

export async function findTranscodingExecution(
	config: CloudRunConfig,
	marker: StudioRecordingReadyMarker,
	dispatchToken: string,
	accessToken: string,
	request: typeof fetch = fetch,
): Promise<string | null> {
	const parent = jobResourceName(config);
	let pageToken: string | undefined;
	do {
		const url = new URL(`https://run.googleapis.com/v2/${parent}/executions`);
		url.searchParams.set("pageSize", "100");
		if (pageToken) url.searchParams.set("pageToken", pageToken);
		const response = await request(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) {
			throw new Error(
				`Cloud Run executions.list failed: ${response.status} ${await response.text()}`,
			);
		}
		const page = (await response.json()) as CloudRunExecutionList;
		for (const execution of page.executions ?? []) {
			if (executionMatchesMarker(execution, marker, dispatchToken)) {
				if (!execution.name) {
					throw new Error("matching Cloud Run execution returned no name");
				}
				return execution.name;
			}
		}
		pageToken = page.nextPageToken || undefined;
	} while (pageToken);
	return null;
}

async function delay(milliseconds: number): Promise<void> {
	if (milliseconds <= 0) return;
	await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function base64Url(input: ArrayBuffer | string): string {
	const bytes =
		typeof input === "string"
			? new TextEncoder().encode(input)
			: new Uint8Array(input);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
	const pem = privateKey
		.replace("-----BEGIN PRIVATE KEY-----", "")
		.replace("-----END PRIVATE KEY-----", "")
		.replace(/\s+/g, "");
	const binary = atob(pem);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return crypto.subtle.importKey(
		"pkcs8",
		bytes,
		{
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256",
		},
		false,
		["sign"],
	);
}

export async function getGoogleAccessToken(
	serviceAccount: GoogleServiceAccount,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const claim = base64Url(
		JSON.stringify({
			iss: serviceAccount.client_email,
			scope: "https://www.googleapis.com/auth/cloud-platform",
			aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
			exp: now + 3600,
			iat: now,
		}),
	);
	const unsigned = `${header}.${claim}`;
	const key = await importPrivateKey(serviceAccount.private_key);
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(unsigned),
	);
	const assertion = `${unsigned}.${base64Url(signature)}`;
	const response = await fetch(
		serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion,
			}),
		},
	);
	if (!response.ok) {
		throw new Error(
			`Google token exchange failed: ${response.status} ${await response.text()}`,
		);
	}
	const token = (await response.json()) as { access_token?: string };
	if (!token.access_token) {
		throw new Error("Google token exchange returned no access_token");
	}
	return token.access_token;
}

export async function runTranscodingJob(
	config: CloudRunConfig,
	marker: StudioRecordingReadyMarker,
	options: RunTranscodingJobOptions = {},
): Promise<string> {
	const request = options.fetch ?? fetch;
	const accessToken =
		options.accessToken ?? (await getGoogleAccessToken(config.serviceAccount));
	const dispatchToken =
		options.dispatchToken ?? (await createStudioDispatchToken(marker));
	const retryAfterSeconds = options.retryAfterSeconds ?? 600;
	const existing = await findTranscodingExecution(
		config,
		marker,
		dispatchToken,
		accessToken,
		request,
	);
	if (existing) return existing;
	if (options.allowCreate === false) {
		throw new CloudRunDispatchPendingError(
			"Cloud Run execution is not visible for the durable Studio dispatch attempt",
			retryAfterSeconds,
		);
	}

	let dispatchError: unknown;
	try {
		const response = await request(
			`https://run.googleapis.com/v2/${jobResourceName(config)}:run`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					overrides: {
						containerOverrides: [
							{
								env: [
									{ name: "VIDEO_ID", value: marker.videoId },
									{ name: "STUDIO_SESSION_ID", value: marker.studioSessionId },
									{ name: "RECORDING_ID", value: marker.recordingId },
									{ name: "SOURCE_BUCKET", value: marker.sourceBucket },
									{ name: "SOURCE_KEY", value: marker.sourceKey },
									{ name: "SOURCE_ETAG", value: marker.sourceEtag },
									{ name: "SOURCE_FORMAT", value: marker.sourceFormat },
									{ name: "OUTPUT_PREFIX", value: marker.outputPrefix },
									{ name: "STUDIO_DISPATCH_TOKEN", value: dispatchToken },
								],
							},
						],
					},
				}),
			},
		);
		if (!response.ok) {
			throw new Error(
				`Cloud Run jobs.run failed: ${response.status} ${await response.text()}`,
			);
		}
		const operation = (await response.json()) as { name?: string };
		return requireCloudRunOperationName(operation);
	} catch (error) {
		dispatchError = error;
	}

	const attempts = Math.max(1, options.reconcileAttempts ?? 3);
	const delayMs = Math.max(0, options.reconcileDelayMs ?? 500);
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (attempt > 0) await delay(delayMs * attempt);
		const execution = await findTranscodingExecution(
			config,
			marker,
			dispatchToken,
			accessToken,
			request,
		).catch(() => null);
		if (execution) return execution;
	}
	throw new CloudRunDispatchPendingError(
		"Cloud Run dispatch was attempted but its execution is not yet visible",
		retryAfterSeconds,
		dispatchError,
	);
}
