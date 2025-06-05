import {
	WorkflowEntrypoint,
	type WorkflowStep,
	type WorkflowEvent,
} from "cloudflare:workers";
import {
	createClient,
	webvtt,
	type SyncPrerecordedResponse,
} from "@deepgram/sdk";
import { gql, request } from "graphql-request";

type Env = {
	AI: Ai;
	DEEPGRAM_API_TOKEN: SecretsStoreSecret;
	TRANSCRIPTIONS_BUCKET: R2Bucket;
};

export type Params = {
	videoId: string;
	language: string;
};

const GET_VIDEO_TERMS = gql`
  query GetVideoTerms($videoId: String!) {
    videoByID(id: $videoId) {
      technologies {
        id
        name
        terms {
          term
        }
      }
    }
  }
`;

interface VideoResponse {
	videoByID: {
		technologies: { id: string; name: string; terms: { term: string }[] }[];
	};
}

async function fetchVideoTerms(videoId: string): Promise<string[]> {
	const endpoint = "https://api.rawkode.academy/graphql";
	const data = (await request(endpoint, GET_VIDEO_TERMS, {
		videoId,
	})) as VideoResponse;
	const terms: string[] = data.videoByID.technologies.map(
		(tech: any) => tech.name,
	);
	return [...new Set(terms)];
}

// Split WebVTT into chunks based on line breaks, targeting ~50k tokens per chunk
function splitWebVTTIntoChunks(vttContent: string): string[] {
	const lines = vttContent.split('\n');
	const chunks: string[] = [];
	let currentChunk: string[] = [];
	let currentTokenCount = 0;
	const targetTokens = 50000; // Since response ≈ input size, we need to account for both in 128k window
	const maxTokens = 60000;

	// Keep the WEBVTT header
	const header = lines[0];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		// Rough estimate: 1 token ≈ 4 characters
		const lineTokens = Math.ceil(line.length / 4);

		// Check if adding this line would exceed our target
		if (currentTokenCount + lineTokens > targetTokens && currentChunk.length > 0) {
			// Look ahead to find a good break point (empty line or timestamp)
			let breakPoint = i;
			for (let j = i; j < Math.min(i + 50, lines.length); j++) {
				if (lines[j].trim() === '' || lines[j].includes('-->')) {
					breakPoint = j;
					break;
				}
			}

			// Create chunk with header
			chunks.push(header + '\n\n' + currentChunk.join('\n'));
			currentChunk = [];
			currentTokenCount = 0;
			i = breakPoint - 1; // Will be incremented in the loop
		} else {
			currentChunk.push(line);
			currentTokenCount += lineTokens;

			// Force a new chunk if we're approaching the max
			if (currentTokenCount > maxTokens) {
				chunks.push(header + '\n\n' + currentChunk.join('\n'));
				currentChunk = [];
				currentTokenCount = 0;
			}
		}
	}

	// Add any remaining content
	if (currentChunk.length > 0) {
		chunks.push(header + '\n\n' + currentChunk.join('\n'));
	}

	return chunks;
}

// Stitch WebVTT chunks back together
function stitchWebVTTChunks(chunks: string[]): string {
	if (chunks.length === 0) return '';

	// Start with WEBVTT header
	const result = ['WEBVTT'];

	// Process each chunk, skipping duplicate headers
	for (const chunk of chunks) {
		const lines = chunk.split('\n');
		let skipHeader = true;

		for (const line of lines) {
			if (skipHeader && line.startsWith('WEBVTT')) {
				continue;
			}
			skipHeader = false;

			// Skip empty lines at the beginning of chunks (except the first chunk)
			if (result.length > 1 && line.trim() === '' && result[result.length - 1].trim() === '') {
				continue;
			}

			result.push(line);
		}
	}

	return result.join('\n');
}

export class TranscribeWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { videoId, language } = event.payload;
		const env = this.env;

		// Check if captions already exist
		const captionsExist = await step.do("check if captions exist", async () => {
			const captionsKey = `videos/${videoId}/captions/en.vtt`;
			const existingCaptions = await env.TRANSCRIPTIONS_BUCKET.head(captionsKey);
			return existingCaptions !== null;
		});

		if (captionsExist) {
			console.log(`Captions already exist for video ${videoId}, skipping transcription`);
			return { success: true, skipped: true };
		}

		const videoTerms = await step.do("fetch video terms", () =>
			fetchVideoTerms(videoId),
		);
		const keyterms = [
			"Flanagan",
			"Rawkode",
			"Rawkode Academy",
			"Kubernetes",
			...videoTerms,
		];

		const deepgram = createClient(await env.DEEPGRAM_API_TOKEN.get());

		const deepgramKey = await step.do(
			"transcribe with Deepgram",
			{
				retries: {
					limit: 7,
					delay: "10 minutes",
					backoff: "exponential",
				},
				timeout: "24 hours",
			},
			async () => {
				const deepgramResponse =
					(await deepgram.listen.prerecorded.transcribeUrl(
						{
							url: `https://content.rawkode.academy/videos/${videoId}/audio.mp3`,
						},
						{
							model: "nova-3",
							language,
							keyterm: keyterms,
							smart_format: true,
							detect_entities: true,
							diarize: true,
							paragraphs: true,
							profanity_filter: false,
							punctuate: true,
							utterances: true,
							replace: ["rawcode:Rawkode"],
						},
					)) as {
						result: SyncPrerecordedResponse | null;
						error: { message: string;[key: string]: any } | null;
					};

				// Improved error handling for the Deepgram step
				if (deepgramResponse.error) {
					console.error(
						`Deepgram transcription failed for video ${videoId}. Error:`,
						JSON.stringify(deepgramResponse.error, null, 2), // Log the full error object
					);
					throw new Error(
						`Deepgram transcription failed for video ${videoId}: ${deepgramResponse.error.message}`,
					);
				}

				// Also check if the result is missing, even if no explicit error is set
				if (!deepgramResponse.result) {
					console.error(
						`Deepgram transcription returned no result for video ${videoId}. Full response:`,
						JSON.stringify(deepgramResponse, null, 2), // Log the full response
					);
					throw new Error(
						`Deepgram transcription returned no result for video ${videoId}.`,
					);
				}

				// Store the Deepgram response in R2 to avoid serialization issues
				// Cloudflare Workflows has size limits on serialized step data
				const deepgramKey = `videos/${videoId}/transcription/deepgram.json`;
				await env.TRANSCRIPTIONS_BUCKET.put(
					deepgramKey,
					JSON.stringify(deepgramResponse.result),
					{
						httpMetadata: { contentType: "application/json" },
					},
				);

				return deepgramKey;
			},
		);

		// Save the original Deepgram WebVTT
		await step.do(
			"save deepgram WebVTT",
			async () => {
				const r2Response = await env.TRANSCRIPTIONS_BUCKET.get(deepgramKey);
				if (!r2Response) {
					throw new Error("Failed to retrieve Deepgram response from R2");
				}

				const deepgramResponse = await r2Response.json() as SyncPrerecordedResponse;
				const deepgramVtt = webvtt(deepgramResponse);

				const deepgramVttKey = `videos/${videoId}/captions/en.deepgram.vtt`;
				await env.TRANSCRIPTIONS_BUCKET.put(deepgramVttKey, deepgramVtt, {
					httpMetadata: { contentType: "text/vtt" },
				});

				return deepgramVttKey;
			}
		);

		// Process WebVTT chunks with AI
		const correctedVttKey = await step.do(
			"review and correct transcript chunks with AI",
			{
				retries: {
					limit: 3,
					delay: "1 minute",
					backoff: "exponential",
				},
				timeout: "24 hours",
			},
			async () => {
				const r2Response = await env.TRANSCRIPTIONS_BUCKET.get(deepgramKey);
				if (!r2Response) {
					throw new Error("Failed to retrieve Deepgram response from R2");
				}

				const deepgramResponse = await r2Response.json() as SyncPrerecordedResponse;
				const vttContent = webvtt(deepgramResponse);

				// Split WebVTT into chunks
				const chunks = splitWebVTTIntoChunks(vttContent);
				console.log(`Split WebVTT into ${chunks.length} chunks`);

				const context = `Rawkode Academy is a technology education platform. The host, David Flanagan (aka Rawkode), is known for deep technical content, especially in cloud native, Kubernetes, and developer tooling. Keyterms: ${keyterms.join(", ")}`;

				// Process chunks in parallel
				const correctedChunks = await Promise.all(
					chunks.map(async (chunk, index) => {
						try {
							const prompt = `You are an expert transcription corrector for technical content. Review this WebVTT transcript chunk for accuracy, focusing on technical terms and names.

Context: ${context}

Please review and correct the following WebVTT chunk, maintaining the exact same format. Fix any technical terms, proper names, and ensure accuracy. Return ONLY the corrected WebVTT chunk with no additional explanation.

WebVTT chunk:
${chunk}`;

							const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
								prompt,
								temperature: 0.1,
								max_tokens: 120000,
							});

							return response.response || chunk; // Fallback to original if AI fails
						} catch (error) {
							console.error(`Error processing chunk ${index}:`, error);
							return chunk; // Return original chunk if processing fails
						}
					})
				);

				// Stitch chunks back together
				const correctedVtt = stitchWebVTTChunks(correctedChunks);

				// Store the corrected WebVTT
				const correctedVttKey = `videos/${videoId}/captions/en.vtt`;
				await env.TRANSCRIPTIONS_BUCKET.put(correctedVttKey, correctedVtt, {
					httpMetadata: { contentType: "text/vtt" },
				});

				return correctedVttKey;
			});

		return { success: true };
	}
}

// Helper function to validate Deepgram response structure
function isValidDeepgramResponse(
	response: any,
): response is SyncPrerecordedResponse {
	return (
		response &&
		typeof response === "object" &&
		response.metadata &&
		typeof response.metadata === "object" &&
		typeof response.metadata.transaction_key === "string" &&
		typeof response.metadata.request_id === "string" &&
		typeof response.metadata.sha256 === "string" &&
		typeof response.metadata.created === "string" &&
		typeof response.metadata.duration === "number" &&
		typeof response.metadata.channels === "number" &&
		Array.isArray(response.metadata.models) &&
		response.results &&
		typeof response.results === "object" &&
		Array.isArray(response.results.channels) &&
		response.results.channels.every(
			(channel: any) =>
				Array.isArray(channel.alternatives) &&
				channel.alternatives.every(
					(alt: any) =>
						typeof alt.transcript === "string" &&
						typeof alt.confidence === "number" &&
						Array.isArray(alt.words) &&
						alt.words.every(
							(word: any) =>
								typeof word.word === "string" &&
								typeof word.start === "number" &&
								typeof word.end === "number" &&
								typeof word.confidence === "number" &&
								typeof word.punctuated_word === "string",
						),
				),
		)
	);
}
