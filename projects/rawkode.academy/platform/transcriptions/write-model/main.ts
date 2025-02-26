import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from '@restatedev/restate-sdk/fetch';
import { createClient, webvtt } from '@deepgram/sdk';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// This avoids using polyfilled node APIs
Deno.env.set('USE_WEB_CRYPTO', 'true');

interface Config {
	language: string;
	videoId: string;
}

const transcriptionService = service({
	name: 'transcription',
	handlers: {
		transcribeVideoById: async (ctx: Context, config: Config) => {
			const deepgram = createClient(Deno.env.get('DEEPGRAM_API_KEY'));

			const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');

			const r2Client = new S3Client({
				region: 'auto',
				endpoint: `https://${
					Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
				}.eu.r2.cloudflarestorage.com`,
				credentials: {
					accessKeyId: Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY') || '',
					secretAccessKey: Deno.env.get('CLOUDFLARE_R2_SECRET_KEY') || '',
				},
			});

			const myRunRetryPolicy = {
				// 5 minutes
				initialRetryIntervalMillis: 300000,
				maxRetryIntervalMillis: 3000000,
				retryIntervalFactor: 5,
				maxRetryAttempts: 1024,
				// 3 days
				maxRetryDurationMillis: 259200000,
			};

			const result = await ctx.run("transcription", async () => {
				const { result, error } = await deepgram.listen.prerecorded
					.transcribeUrl(
						{
							url:
								`https://videos.rawkode.academy/${config.videoId}/youtube/video.mkv`,
						},
						{
							model: 'nova-3',
							language: config.language,
							keyterm: ['Rawkode', 'Rawkode Academy'],
						},
					);

				if (error) {
					throw error;
				}

				return result;
			}, myRunRetryPolicy);

			const captions = webvtt(result);

			try {
				const captionsKey = `${config.videoId}/captions/en.vtt`;

				const encoder = new TextEncoder();
				const captionsBytes = encoder.encode(captions);

				await r2Client.send(
					new PutObjectCommand({
						Bucket: bucketName,
						Key: captionsKey,
						Body: captionsBytes,
						ContentLength: captionsBytes.byteLength,
						ContentType: 'text/vtt',
					}),
				);

				return `Captions uploaded to R2: ${captionsKey}`;
			} catch (error) {
				console.error('Error uploading captions to R2:', error);
				throw new TerminalError('Failed to upload captions to R2', {
					errorCode: 500,
					cause: error,
				});
			}
		},
	},
});

const handler = endpoint().bind(transcriptionService).withIdentityV1(
	Deno.env.get('RESTATE_IDENTITY_KEY') || '',
).bidirectional().handler();

Deno.serve(
	{ port: parseInt(Deno.env.get('PORT') || '9080', 10) },
	handler.fetch,
);
