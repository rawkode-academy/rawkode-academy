import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient, webvtt } from "@deepgram/sdk";
import { type Context, endpoint, service } from "@restatedev/restate-sdk/fetch";
import { gql, request } from "graphql-request";
import process from "node:process";

process.env.USE_WEB_CRYPTO = "true";

interface Config {
	language: string;
	videoId: string;
}

interface Technology {
	id: string;
	name: string;
	terms: { term: string }[];
}

interface VideoResponse {
	videoByID: {
		technologies: Technology[];
	};
}

// GraphQL query to fetch video technologies and terms
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

const fetchVideoTerms = async (videoId: string): Promise<string[]> => {
	const endpoint = "https://api.rawkode.academy/graphql";

	const data = await request<VideoResponse>(endpoint, GET_VIDEO_TERMS, {
		videoId,
	});

	const terms: string[] = data.videoByID.technologies.map((tech) => tech.name);

	return [...new Set(terms)];
};

interface R2Config {
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
}

const transcriptionService = service({
	name: "transcription",
	handlers: {
		transcribeVideoById: async (ctx: Context, config: Config) => {
			ctx.console.info("Transcribing video:", config.videoId);

			const r2Config = JSON.parse(
				process.env.CLOUDFLARE_R2_CONFIG || "",
			) as R2Config;

			const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

			const bucketName = r2Config.bucket;

			const r2Client = new S3Client({
				region: "auto",
				endpoint: r2Config.endpoint,
				credentials: {
					accessKeyId: r2Config.accessKeyId,
					secretAccessKey: r2Config.secretAccessKey,
				},
			});

			const videoTerms = await ctx.run("get-transcription-terms", () => {
				ctx.console.info(
					`Fetching technology terms for video: ${config.videoId}`,
				);
				return fetchVideoTerms(config.videoId);
			});

			const keyterms = [
				"Flanagan",
				"Rawkode",
				"Rawkode Academy",
				"Kubernetes",
				...videoTerms,
			];
			ctx.console.info(
				`Using keyterms for transcription: ${keyterms.join(", ")}`,
			);

			const deepgramRetryPolicy = {
				// 5 minutes
				initialRetryIntervalMillis: 300000,

				// 50 minutes
				maxRetryIntervalMillis: 3000000,

				retryIntervalFactor: 1.2,
				maxRetryAttempts: 1024,

				// 3 days
				maxRetryDurationMillis: 259200000,
			};

			const result = await ctx.run(
				"transcription",
				async () => {
					ctx.console.info("Sending transcription request to Deepgram");
					const { result, error } = await deepgram.listen.prerecorded
						.transcribeUrl(
							{
								url:
									`https://content.rawkode.academy/videos/${config.videoId}/original.mkv`,
							},
							{
								model: "nova-3",
								language: config.language,
								keyterm: keyterms,
								smart_format: true,
								detect_entities: true,
								diarize: true,
								paragraphs: true,
								profanity_filter: false,
								punctuate: true,
								utterances: true,
								replace: ["rawcode:Rawkode"]
							},
					);

					if (error) {
						ctx.console.error(
							"Error transcribing video:",
							error.message,
						);
						throw error;
					}

					ctx.console.info("Transcription result:", result);
					return result;
				},
				deepgramRetryPolicy,
			);

			await ctx.run("upload-transcription", async () => {
				ctx.console.info("Uploading transcription to R2");

				const transcript = JSON.stringify(result);

				const transcriptKey = `videos/${config.videoId}/transcription.json`;

				const s3Put = await r2Client.send(
					new PutObjectCommand({
						Bucket: bucketName,
						Key: transcriptKey,
						Body: JSON.stringify(transcript),
						ContentType: "application/json",
					}),
				);

				if (s3Put.$metadata.httpStatusCode !== 200) {
					throw new Error(
						`Failed to upload transcription to R2: ${s3Put.$metadata.httpStatusCode}`,
					);
				}

				ctx.console.log(`Transcription uploaded to R2: ${transcriptKey}`);
				return;
			});

			await ctx.run("upload-captions", async () => {
				ctx.console.info("Uploading captions to R2");

				const captions = webvtt(result);

				const captionsKey = `videos/${config.videoId}/captions/en.vtt`;

				const encoder = new TextEncoder();
				const captionsBytes = encoder.encode(captions);

				const s3Put = await r2Client.send(
					new PutObjectCommand({
						Bucket: bucketName,
						Key: captionsKey,
						Body: captionsBytes,
						ContentLength: captionsBytes.byteLength,
						ContentType: "text/vtt",
					}),
				);

				if (s3Put.$metadata.httpStatusCode !== 200) {
					throw new Error(
						`Failed to upload captions to R2: ${s3Put.$metadata.httpStatusCode}`,
					);
				}

				ctx.console.log(`Captions uploaded to R2: ${captionsKey}`);
				return;
			});
		},
	},
});

const handler = endpoint()
	.bind(transcriptionService)
	.bidirectional()
	.withIdentityV1(process.env.RESTATE_IDENTITY_KEY || "")
	.handler();

Deno.serve(
	{ port: parseInt(Deno.env.get("PORT") || "9080", 10) },
	handler.fetch,
);
