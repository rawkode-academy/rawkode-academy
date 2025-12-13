export interface TranscriptionsBindings {
	TRANSCRIPTIONS_SERVICE?: Fetcher;
	TRANSCRIPTIONS?: Fetcher;
	HTTP_TRANSCRIPTION_TOKEN?: string;
}

const SERVICE_URL = "https://transcriptions.internal/transcribe";

function resolveBinding(bindings?: TranscriptionsBindings): Fetcher {
	const binding =
		bindings?.TRANSCRIPTIONS_SERVICE ??
		bindings?.TRANSCRIPTIONS ??
		// @ts-expect-error - service bindings are injected at runtime
		(globalThis as any).TRANSCRIPTIONS_SERVICE ??
		// @ts-expect-error - alternate binding name
		(globalThis as any).TRANSCRIPTIONS;

	if (!binding || typeof (binding as any).fetch !== "function") {
		throw new Error(
			"Missing transcriptions service binding (TRANSCRIPTIONS_SERVICE). Configure a service binding; HTTP fallback is not supported.",
		);
	}

	return binding as Fetcher;
}

function resolveAuthToken(bindings?: TranscriptionsBindings): string {
	const token =
		bindings?.HTTP_TRANSCRIPTION_TOKEN ??
		(typeof process !== "undefined"
			? process.env.HTTP_TRANSCRIPTION_TOKEN
			: undefined);

	if (!token) {
		throw new Error("Missing HTTP_TRANSCRIPTION_TOKEN for transcription service");
	}

	return token;
}

export async function triggerTranscriptionJob(
	payload: { id: string; language?: string },
	bindings?: TranscriptionsBindings,
): Promise<{ workflowId: string }> {
	const service = resolveBinding(bindings);
	const token = resolveAuthToken(bindings);

	const response = await service.fetch(SERVICE_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			id: payload.id,
			language: payload.language ?? "en",
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Transcription service returned ${response.status} ${response.statusText}: ${body}`,
		);
	}

	const result = (await response.json()) as { workflowId: string };
	return result;
}
