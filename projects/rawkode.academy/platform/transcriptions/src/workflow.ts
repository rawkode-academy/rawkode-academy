import {
	WorkflowEntrypoint,
	type WorkflowStep,
	type WorkflowEvent,
} from "cloudflare:workers";
import { gql, request } from "graphql-request";

type Env = {
	AI: Ai;
	TRANSCRIPTIONS_BUCKET: R2Bucket;
};

export type Params = {
	id: string;
	language: string;
};

const GET_VIDEO_DETAILS = gql`
  query GetVideoDetails($id: String!) {
    videoByID(id: $id) {
      id
      streamUrl
      thumbnailUrl
      technologies {
        id
        name
        terms
      }
    }
  }
`;

interface VideoResponse {
	videoByID: {
		id: string;
		streamUrl?: string | null;
		thumbnailUrl?: string | null;
		technologies: { id: string; name: string; terms: string[] | null }[];
	} | null;
}

type Nova3Response = Ai_Cf_Deepgram_Nova_3_Output;

type TranscriptWord = {
	word?: string;
	start?: number;
	end?: number;
	confidence?: number;
};

function extractVideoId(
	streamUrl?: string | null,
	thumbnailUrl?: string | null,
): string | null {
	const source = streamUrl ?? thumbnailUrl ?? "";
	const match = source.match(/\/videos\/([^/]+)\//);
	return match ? match[1] : null;
}

async function fetchVideoDetails(
	id: string,
): Promise<{ videoId: string; keyterms: string[] }> {
	const endpoint = "https://api.rawkode.academy";
	const data = (await request(endpoint, GET_VIDEO_DETAILS, {
		id,
	})) as VideoResponse;

	if (!data.videoByID) {
		throw new Error(`Video ${id} not found in GraphQL`);
	}

	const videoId = extractVideoId(
		data.videoByID.streamUrl,
		data.videoByID.thumbnailUrl,
	);

	if (!videoId) {
		throw new Error(`Unable to derive videoId for video ${id}`);
	}

	const allTerms: string[] = [];
	for (const tech of data.videoByID.technologies) {
		allTerms.push(tech.name);
		if (tech.terms) {
			allTerms.push(...tech.terms);
		}
	}

	return {
		videoId,
		keyterms: [...new Set(allTerms)],
	};
}

function formatVttTimestamp(seconds: number): string {
	const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
	const milliseconds = totalMilliseconds % 1000;
	const totalSeconds = Math.floor(totalMilliseconds / 1000);
	const secs = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${milliseconds
		.toString()
		.padStart(3, "0")}`;
}

function escapeVttText(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function getTranscriptWords(response: Nova3Response): TranscriptWord[] {
	return (
		response.results?.channels?.flatMap((channel) =>
			channel.alternatives?.at(0)?.words ?? []
		) ?? []
	);
}

function webvtt(response: Nova3Response): string {
	const words = getTranscriptWords(response).filter(
		(word): word is Required<Pick<TranscriptWord, "word" | "start" | "end">> &
			TranscriptWord =>
			typeof word.word === "string" &&
			typeof word.start === "number" &&
			typeof word.end === "number",
	);

	if (words.length === 0) {
		const transcript =
			response.results?.channels?.at(0)?.alternatives?.at(0)?.transcript?.trim();

		if (!transcript) {
			throw new Error("Workers AI nova-3 response did not include transcript words");
		}

		return [
			"WEBVTT",
			"",
			"00:00:00.000 --> 00:00:01.000",
			escapeVttText(transcript),
			"",
		].join("\n");
	}

	const cues: string[] = ["WEBVTT", ""];
	let cueWords: typeof words = [];
	let cueStart = words[0].start;
	let cueEnd = words[0].end;

	const flushCue = () => {
		if (cueWords.length === 0) return;
		const text = cueWords.map((word) => word.word).join(" ");
		cues.push(
			`${formatVttTimestamp(cueStart)} --> ${formatVttTimestamp(cueEnd)}`,
			escapeVttText(text),
			"",
		);
		cueWords = [];
	};

	for (const word of words) {
		if (cueWords.length === 0) {
			cueStart = word.start;
		}

		cueWords.push(word);
		cueEnd = word.end;

		const duration = cueEnd - cueStart;
		const hasSentenceBreak = /[.!?]$/.test(word.word);
		if (duration >= 6 || cueWords.length >= 16 || hasSentenceBreak) {
			flushCue();
		}
	}

	flushCue();
	return cues.join("\n");
}

function isValidNova3Response(response: unknown): response is Nova3Response {
	if (!response || typeof response !== "object") return false;

	const result = response as Nova3Response;
	const alternatives = result.results?.channels?.flatMap(
		(channel) => channel.alternatives ?? [],
	);

	return Array.isArray(alternatives) &&
		alternatives.some((alternative) =>
			typeof alternative.transcript === "string" ||
			Array.isArray(alternative.words)
		);
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
		const { id, language } = event.payload;
		const env = this.env;

		const { videoId, keyterms: videoTerms } = await step.do(
			"fetch video details",
			() => fetchVideoDetails(id),
		);

		// Check if captions already exist
		const captionsExist = await step.do("check if captions exist", async () => {
			const captionsKey = `videos/${videoId}/captions/en.vtt`;
			const existingCaptions = await env.TRANSCRIPTIONS_BUCKET.head(captionsKey);
			return existingCaptions !== null;
		});

		if (captionsExist) {
			return { success: true, skipped: true };
		}

		const keyterms = [
			"Flanagan",
			"Rawkode",
			"Rawkode Academy",
			"Kubernetes",
			...videoTerms,
		];

		const deepgramKey = await step.do(
			"transcribe with Workers AI nova-3",
			{
				retries: {
					limit: 7,
					delay: "10 minutes",
					backoff: "exponential",
				},
				timeout: "24 hours",
			},
			async () => {
				const audioResponse = await fetch(
					`https://content.rawkode.academy/videos/${videoId}/original.mp3`,
				);

				if (!audioResponse.ok || !audioResponse.body) {
					throw new Error(
						`Failed to fetch MP3 for video ${videoId}: ${audioResponse.status} ${audioResponse.statusText}`,
					);
				}

				const deepgramResponse = await env.AI.run("@cf/deepgram/nova-3", {
					audio: {
						body: audioResponse.body,
						contentType:
							audioResponse.headers.get("content-type") ?? "audio/mpeg",
					},
					language,
					keyterm: keyterms.join(","),
					smart_format: true,
					detect_entities: true,
					diarize: true,
					paragraphs: true,
					profanity_filter: false,
					punctuate: true,
					utterances: true,
					replace: "rawcode:Rawkode",
				});

				if (!isValidNova3Response(deepgramResponse)) {
					console.error(
						`Workers AI nova-3 returned no transcript for video ${videoId}. Full response:`,
						JSON.stringify(deepgramResponse, null, 2),
					);
					throw new Error(
						`Workers AI nova-3 returned no transcript for video ${videoId}.`,
					);
				}

				// Store the nova-3 response in R2 to avoid serialization issues
				// Cloudflare Workflows has size limits on serialized step data
				const deepgramKey = `videos/${videoId}/transcription/deepgram.json`;
				await env.TRANSCRIPTIONS_BUCKET.put(
					deepgramKey,
					JSON.stringify(deepgramResponse),
					{
						httpMetadata: { contentType: "application/json" },
					},
				);

				return deepgramKey;
			},
		);

		// Save the original nova-3 WebVTT
		await step.do(
			"save deepgram WebVTT",
			async () => {
				const r2Response = await env.TRANSCRIPTIONS_BUCKET.get(deepgramKey);
				if (!r2Response) {
					throw new Error("Failed to retrieve nova-3 response from R2");
				}

				const deepgramResponse = await r2Response.json() as Nova3Response;
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
					throw new Error("Failed to retrieve nova-3 response from R2");
				}

				const deepgramResponse = await r2Response.json() as Nova3Response;
				const vttContent = webvtt(deepgramResponse);

				// Split WebVTT into chunks
				const chunks = splitWebVTTIntoChunks(vttContent);

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

							return typeof response.response === "string"
								? response.response
								: chunk; // Fallback to original if AI fails
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
