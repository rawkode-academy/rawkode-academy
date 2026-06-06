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

export function requireCloudRunOperationName(operation: { name?: string }): string {
	if (!operation.name) {
		throw new Error("Cloud Run jobs.run returned no operation name");
	}
	return operation.name;
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
	const response = await fetch(serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		}),
	});
	if (!response.ok) {
		throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
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
): Promise<string> {
	const token = await getGoogleAccessToken(config.serviceAccount);
	const response = await fetch(
		`https://run.googleapis.com/v2/projects/${config.projectId}/locations/${config.location}/jobs/${config.jobName}:run`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
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
							],
						},
					],
				},
			}),
		},
	);
	if (!response.ok) {
		throw new Error(`Cloud Run jobs.run failed: ${response.status} ${await response.text()}`);
	}
	const operation = (await response.json()) as { name?: string };
	return requireCloudRunOperationName(operation);
}
