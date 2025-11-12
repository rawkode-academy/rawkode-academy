interface Env {
	EMAIL_PREFERENCES: KVNamespace;
	CORS_ORIGIN?: string;
}

interface PreferencePayload {
	audience: string;
	channel?: string;
	status?: "subscribed" | "unsubscribed";
	source?: string;
	metadata?: Record<string, unknown>;
}

interface StoredPreference {
	userId: string;
	createdAt: string;
	updatedAt: string;
	preferences: Record<string, StoredPreferenceEntry>;
}

interface StoredPreferenceEntry {
	audience: string;
	channel: string;
	status: "subscribed" | "unsubscribed";
	source?: string;
	metadata?: Record<string, unknown>;
	updatedAt: string;
}

const CHANNELS = new Set(["marketing", "newsletter", "service"]);

function extractUserIdFromJWT(authHeader: string): string | null {
	try {
		// Extract Bearer token
		if (!authHeader.startsWith("Bearer ")) {
			return null;
		}

		const token = authHeader.slice("Bearer ".length).trim();

		// JWT is formatted as: header.payload.signature
		// We only need to decode the payload (base64url encoded)
		const parts = token.split(".");
		if (parts.length !== 3) {
			return null;
		}

		// Decode the payload (second part)
		const payload = parts[1];
		// Base64url to base64
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const decoded = atob(base64);
		const parsed = JSON.parse(decoded);

		// Extract sub (subject) claim which should be the userId
		return parsed.sub || null;
	} catch {
		return null;
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const corsOrigin = env.CORS_ORIGIN;

		if (url.pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		if (url.pathname === "/api/preferences") {
			// Handle OPTIONS preflight request for CORS
			if (request.method === "OPTIONS") {
				const headers: Record<string, string> = {};
				if (corsOrigin) {
					headers["Access-Control-Allow-Origin"] = corsOrigin;
					headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
					headers["Access-Control-Allow-Headers"] =
						"Content-Type, Authorization";
					headers["Access-Control-Max-Age"] = "86400";
				}
				return new Response(null, { status: 204, headers });
			}

			if (request.method !== "POST") {
				return methodNotAllowed(corsOrigin);
			}

			const authHeader = request.headers.get("authorization") ?? "";

			// Extract userId from JWT
			const userId = extractUserIdFromJWT(authHeader);
			if (!userId) {
				return unauthorized(corsOrigin);
			}

			let payload: PreferencePayload;
			try {
				payload = await request.json();
			} catch (error) {
				if (error instanceof SyntaxError) {
					return badRequest("Invalid JSON payload", corsOrigin);
				}
				return badRequest("Failed to parse request body", corsOrigin);
			}

			const validation = validatePayload(payload);
			if (!validation.valid) {
				return badRequest(validation.error ?? "Validation failed", corsOrigin);
			}

			const normalized = validation.value;
			const storageKey = `user:${userId}:preferences`;
			const now = new Date().toISOString();
			const existing = (await env.EMAIL_PREFERENCES.get<StoredPreference>(
				storageKey,
				{
					type: "json",
				},
			)) || {
				userId,
				createdAt: now,
				updatedAt: now,
				preferences: {},
			};

			const preferenceKey = `${normalized.channel}:${normalized.audience}`;
			const previousPreference = existing.preferences[preferenceKey];

			const entry: StoredPreferenceEntry = {
				audience: normalized.audience,
				channel: normalized.channel,
				status: normalized.status,
				source: normalized.source,
				metadata: normalized.metadata,
				updatedAt: now,
			};

			existing.preferences[preferenceKey] = entry;
			existing.updatedAt = now;

			await env.EMAIL_PREFERENCES.put(storageKey, JSON.stringify(existing));

			const alreadySubscribed =
				previousPreference !== undefined &&
				previousPreference.status === normalized.status;
			const statusCode = alreadySubscribed ? 200 : 201;

			return jsonResponse(
				{
					success: true,
					alreadySubscribed,
					userId,
					preference: entry,
				},
				statusCode,
				corsOrigin,
			);
		}

		return new Response("Not Found", { status: 404 });
	},
};

function badRequest(message: string, corsOrigin?: string): Response {
	return jsonResponse({ error: message }, 400, corsOrigin);
}

function unauthorized(corsOrigin?: string): Response {
	return jsonResponse({ error: "Unauthorized" }, 401, corsOrigin);
}

function methodNotAllowed(corsOrigin?: string): Response {
	return jsonResponse({ error: "Method Not Allowed" }, 405, corsOrigin);
}

function jsonResponse(
	body: Record<string, unknown>,
	status = 200,
	corsOrigin?: string,
): Response {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};

	if (corsOrigin) {
		headers["Access-Control-Allow-Origin"] = corsOrigin;
		headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
		headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
	}

	return new Response(JSON.stringify(body), {
		status,
		headers,
	});
}

function validatePayload(
	payload: PreferencePayload,
):
	| { valid: true; value: RequiredPreferencePayload }
	| { valid: false; error?: string } {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const audience = (payload.audience ?? "").toString().trim();
	if (!audience) {
		return { valid: false, error: "Audience identifier is required" };
	}

	const rawChannel = (payload.channel ?? "marketing")
		.toString()
		.trim()
		.toLowerCase();
	const channel = CHANNELS.has(rawChannel) ? rawChannel : "marketing";

	const status =
		payload.status === "unsubscribed" ? "unsubscribed" : "subscribed";

	let metadata: Record<string, unknown> | undefined;
	if (payload.metadata && typeof payload.metadata === "object") {
		// Validate metadata size to prevent storage abuse
		const metadataStr = JSON.stringify(payload.metadata);
		if (metadataStr.length > 10000) {
			return { valid: false, error: "Metadata object is too large (max 10KB)" };
		}
		metadata = payload.metadata;
	}

	const source = (payload.source ?? "website").toString().trim();
	// Validate source length
	if (source.length > 255) {
		return {
			valid: false,
			error: "Source field is too long (max 255 characters)",
		};
	}

	return {
		valid: true,
		value: {
			audience,
			channel,
			status,
			source,
			metadata,
		},
	};
}

interface RequiredPreferencePayload {
	audience: string;
	channel: string;
	status: "subscribed" | "unsubscribed";
	source: string;
	metadata?: Record<string, unknown>;
}
