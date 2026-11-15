/**
 * Verifies a Rawkode Academy video import stage by stage, from public
 * evidence only: the importer's state file when this machine has one, the
 * content bucket over HTTP and the GraphQL API. It triggers nothing; a stage
 * counts as done when its artifact answers, never because a job was started.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	evaluate,
	failureMessage,
	firstMissing,
	type ImporterState,
	type Observations,
	parseImporterState,
	parseYouTubeId,
	type Probe,
	type Stage,
	STAGES,
	stageUrls,
} from "./_lib/video.ts";
import { inParallel, request } from "./_lib/http.ts";

const POLL_INTERVAL_MILLISECONDS = 15_000;

const VIDEO_FIELDS = "id slug title youtubeId publishedAt duration";

const GlobalArgsSchema = z.object({
	apiUrl: z.string().url().default("https://api.rawkode.academy/")
		.describe("GraphQL gateway that answers videoByID"),
	contentUrl: z.string().url().default("https://content.rawkode.academy")
		.describe("Public base URL of the content bucket"),
	importerStateDirectory: z.string().default("")
		.describe(
			"Directory of the importer's state files; empty means ~/.youtube_to_r2_state",
		),
});
type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const TargetSchema = z.object({
	youtubeId: z.string().default("")
		.describe("YouTube id or URL of the imported video"),
	videoId: z.string().default("")
		.describe(
			"Rawkode Academy video id (the importer's CUID); resolved from the YouTube id when empty",
		),
	requireImporterState: z.boolean().default(false)
		.describe(
			"Fail the upload and video stages when this machine has no importer state for the YouTube id",
		),
});
type Target = z.infer<typeof TargetSchema>;

const StageSchema = z.object({
	evidenced: z.boolean(),
	evidence: z.array(z.string()),
	missing: z.array(z.string()),
});

const StatusSchema = z.object({
	inspectedAt: z.string(),
	youtubeId: z.string().nullable(),
	videoId: z.string().nullable(),
	resolution: z.string(),
	importerSteps: z.array(z.string()).nullable(),
	video: z.record(z.string(), z.unknown()).nullable(),
	stages: z.object({
		upload: StageSchema,
		video: StageSchema,
		transcoding: StageSchema,
		transcription: StageSchema,
	}),
	firstMissing: z.string().nullable(),
	summary: z.string(),
});

const VerificationSchema = z.object({
	verifiedAt: z.string(),
	through: z.string(),
	youtubeId: z.string().nullable(),
	videoId: z.string(),
	evidence: z.record(z.string(), z.array(z.string())),
});

interface Context {
	globalArgs: GlobalArgs;
	logger: {
		info: (message: string, properties: Record<string, unknown>) => void;
	};
	writeResource: (
		specName: string,
		name: string,
		data: Record<string, unknown>,
	) => Promise<{ name: string }>;
}

async function query(
	apiUrl: string,
	document: string,
	variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
	const response = await request(apiUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query: document, variables }),
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(
			`${apiUrl} answered ${response.status}: ${text.slice(0, 300)}`,
		);
	}
	const body = JSON.parse(text) as {
		data?: Record<string, unknown>;
		errors?: Array<{ message: string }>;
	};
	if (body.errors?.length || !body.data) {
		throw new Error(
			`${apiUrl} refused the query: ${
				body.errors?.map((error) => error.message).join("; ") ?? "no data"
			}`,
		);
	}
	return body.data;
}

async function readImporterState(
	directory: string,
	youtubeId: string,
): Promise<ImporterState | null> {
	const path = `${
		directory || `${Deno.env.get("HOME")}/.youtube_to_r2_state`
	}/${youtubeId}.json`;
	try {
		return parseImporterState(await Deno.readTextFile(path));
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return null;
		throw error;
	}
}

async function probe(url: string): Promise<Probe> {
	try {
		const response = await request(url, { method: "HEAD" });
		await response.body?.cancel();
		return { url, status: response.status };
	} catch (error) {
		return {
			url,
			status: null,
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Gather every observation the stages are judged on. */
async function observe(
	target: Target,
	globalArgs: GlobalArgs,
): Promise<Observations> {
	const youtubeId = target.youtubeId ? parseYouTubeId(target.youtubeId) : null;
	if (target.youtubeId && !youtubeId) {
		throw new Error(`Not a YouTube id or URL: ${target.youtubeId}`);
	}
	if (!youtubeId && !target.videoId) {
		throw new Error("Give a youtubeId, a videoId, or both");
	}
	const { apiUrl, contentUrl } = globalArgs;

	const importerState = youtubeId
		? await readImporterState(globalArgs.importerStateDirectory, youtubeId)
		: null;
	if (
		target.videoId && importerState?.videoId &&
		importerState.videoId !== target.videoId
	) {
		throw new Error(
			`The importer state for ${youtubeId} belongs to video ${importerState.videoId}, not ${target.videoId}`,
		);
	}

	let videoId: string | null = target.videoId || null;
	let resolution = "given as the video id";
	if (!videoId && importerState?.videoId) {
		videoId = importerState.videoId;
		resolution = `read from the importer state for ${youtubeId}`;
	}
	if (!videoId) {
		const { getAllVideos } = await query(
			apiUrl,
			"{ getAllVideos { id youtubeId } }",
		) as { getAllVideos: Array<{ id: string; youtubeId: string | null }> };
		videoId = getAllVideos.find((video) => video.youtubeId === youtubeId)?.id ??
			null;
		resolution = videoId
			? `found by YouTube id ${youtubeId} in ${apiUrl}`
			: `no video id: this machine has no importer state for ${youtubeId} and ${apiUrl} lists no video with that YouTube id`;
	}

	if (!videoId) {
		return {
			youtubeId,
			videoId,
			resolution,
			importerState,
			requireImporterState: target.requireImporterState,
			video: null,
			apiUrl,
			probes: [],
		};
	}
	const [{ videoByID }, probes] = await Promise.all([
		query(
			apiUrl,
			`query($id: String!) { videoByID(id: $id) { ${VIDEO_FIELDS} } }`,
			{ id: videoId },
		),
		inParallel(Object.values(stageUrls(contentUrl, videoId)).flat(), probe),
	]);
	return {
		youtubeId,
		videoId,
		resolution,
		importerState,
		requireImporterState: target.requireImporterState,
		video: videoByID as Record<string, unknown> | null,
		apiUrl,
		probes,
	};
}

function summarize(stages: Stage[]): string {
	return stages.map((stage) =>
		`${stage.name}: ${
			stage.evidenced ? "evidenced" : `missing (${stage.missing.join("; ")})`
		}`
	).join("\n");
}

/** Behavior definition for verifying video imports. */
export const behavior = {
	type: "@rawkode/academy/video",
	version: "2026.11.11.1",
	globalArguments: GlobalArgsSchema,
	resources: {
		status: {
			description:
				"What is and is not evidenced for the last inspected video, stage by stage",
			schema: StatusSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		verification: {
			description: "The evidence that a video's stages are done",
			schema: VerificationSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		inspect: {
			description:
				"Record which import stages (upload, video, transcoding, transcription) are evidenced for a video, without failing on the missing ones",
			arguments: TargetSchema,
			execute: async (
				args: Target,
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const observations = await observe(args, context.globalArgs);
				const stages = evaluate(observations, context.globalArgs.contentUrl);
				const missing = firstMissing(stages);
				context.logger.info("Video {video}: first missing stage is {stage}", {
					video: observations.videoId ?? observations.youtubeId,
					stage: missing?.name ?? "none",
				});
				const handle = await context.writeResource("status", "status", {
					inspectedAt: new Date().toISOString(),
					youtubeId: observations.youtubeId,
					videoId: observations.videoId,
					resolution: observations.resolution,
					importerSteps: observations.importerState?.completedSteps ?? null,
					video: observations.video,
					stages: Object.fromEntries(
						stages.map(({ name, ...stage }) => [name, stage]),
					),
					firstMissing: missing?.name ?? null,
					summary: summarize(stages),
				});
				return { dataHandles: [handle] };
			},
		},
		verify: {
			description:
				"Fail, naming the first missing stage, unless every stage up to and including `through` is evidenced; optionally wait for the artifact of `through` to appear",
			arguments: TargetSchema.extend({
				through: z.enum(STAGES).default("transcription")
					.describe("The last stage that has to be evidenced"),
				waitSeconds: z.number().int().min(0).default(0)
					.describe(
						"How long to keep polling for the `through` stage before failing; 0 checks once",
					),
			}),
			execute: async (
				args: Target & { through: typeof STAGES[number]; waitSeconds: number },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const deadline = Date.now() + args.waitSeconds * 1000;
				for (;;) {
					const observations = await observe(args, context.globalArgs);
					const stages = evaluate(observations, context.globalArgs.contentUrl);
					const missing = firstMissing(stages, args.through);
					if (!missing) {
						const handle = await context.writeResource(
							"verification",
							`verification-${args.through}`,
							{
								verifiedAt: new Date().toISOString(),
								through: args.through,
								youtubeId: observations.youtubeId,
								videoId: observations.videoId,
								evidence: Object.fromEntries(
									stages
										.slice(0, STAGES.indexOf(args.through) + 1)
										.map((stage) => [stage.name, stage.evidence]),
								),
							},
						);
						return { dataHandles: [handle] };
					}
					// Only the stage being waited for can appear by waiting.
					const remaining = deadline - Date.now();
					if (missing.name !== args.through || remaining <= 0) {
						throw new Error(failureMessage(missing));
					}
					context.logger.info(
						"Stage {stage} is not evidenced yet; {seconds}s left",
						{ stage: missing.name, seconds: Math.round(remaining / 1000) },
					);
					await new Promise((resolve) =>
						setTimeout(
							resolve,
							Math.min(POLL_INTERVAL_MILLISECONDS, remaining),
						)
					);
				}
			},
		},
	},
};
