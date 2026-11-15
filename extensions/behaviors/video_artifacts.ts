/**
 * Backfills the artifacts derived from Rawkode Academy videos: captions
 * (`captions/en.vtt`) and thumbnails (`thumbnail.webp`) in the content bucket.
 * It finds published videos that lack one, starts the Cloudflare Workflow
 * that produces it, and then checks that the artifact is really served.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	ARTIFACT_KINDS,
	type ArtifactKind,
	type ArtifactState,
	artifactState,
	artifactUrl,
	instanceRequest,
	isValidVideoIdentifier,
	type Job,
	parseKinds,
	parseList,
	planArtifact,
	selectVideos,
	type Skipped,
	summarize,
	type Video,
	VIDEOS_QUERY,
} from "./_lib/video_artifacts.ts";
import { inParallel, request } from "./_lib/http.ts";

// Videos checked per round; discovery stops early once `maximum` jobs are planned.
const VIDEOS_PER_ROUND = 8;
// The transcription script waits this long between triggers.
const TRIGGER_PAUSE_MILLISECONDS = 1_000;

const GlobalArgsSchema = z.object({
	apiUrl: z.string().url().default("https://api.rawkode.academy/")
		.describe("GraphQL gateway the videos are listed from"),
	contentUrl: z.string().url().default("https://content.rawkode.academy")
		.describe("Public base URL of the content bucket that serves artifacts"),
	accountId: z.string().default("")
		.describe(
			"Cloudflare account that owns the Workflows; only trigger needs it",
		),
});
type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const KindSchema = z.enum(ARTIFACT_KINDS);

const JobSchema = z.object({
	videoId: z.string(),
	kind: KindSchema,
	url: z.string(),
	workflow: z.string(),
	params: z.record(z.string(), z.unknown()),
});

const ArtifactSchema = z.object({
	videoId: z.string(),
	kind: KindSchema,
	url: z.string(),
});

const PlanSchema = z.object({
	createdAt: z.string(),
	kinds: z.array(KindSchema),
	listed: z.number().describe("Published videos the gateway returned"),
	checked: z.number().describe("Videos whose artifacts were checked"),
	jobs: z.array(JobSchema).describe("One job per missing artifact"),
	skipped: z.array(ArtifactSchema.extend({ reason: z.string() }))
		.describe("Artifacts that are not present but will not be triggered"),
	summary: z.string(),
});
type Plan = z.infer<typeof PlanSchema>;

const TriggerSchema = z.object({
	triggeredAt: z.string(),
	planCreatedAt: z.string(),
	instances: z.array(
		ArtifactSchema.extend({ workflow: z.string(), instanceId: z.string() }),
	),
	failures: z.array(
		ArtifactSchema.extend({ workflow: z.string(), error: z.string() }),
	),
});

const VerificationSchema = z.object({
	verifiedAt: z.string(),
	planCreatedAt: z.string(),
	present: z.array(ArtifactSchema),
	absent: z.array(ArtifactSchema.extend({ detail: z.string() })),
});

interface Context {
	globalArgs: GlobalArgs;
	repoDir: string;
	logger: {
		info: (message: string, properties: Record<string, unknown>) => void;
	};
	writeResource: (
		specName: string,
		name: string,
		data: Record<string, unknown>,
	) => Promise<{ name: string }>;
	readResource?: (name: string) => Promise<Record<string, unknown> | null>;
}

async function listVideos(apiUrl: string): Promise<Video[]> {
	const response = await request(apiUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query: VIDEOS_QUERY }),
	});
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`${apiUrl} answered ${response.status}`);
	}
	const payload = await response.json() as {
		data?: { getAllVideos?: Array<Video | null> | null } | null;
		errors?: Array<{ message?: string }>;
	};
	if (payload.errors?.length) {
		throw new Error(
			`GraphQL failed to list videos: ${
				payload.errors.map((error) => error.message ?? "unknown error")
					.join("; ")
			}`,
		);
	}
	const videos = payload.data?.getAllVideos;
	if (!Array.isArray(videos)) {
		throw new Error("GraphQL response did not include getAllVideos");
	}
	return videos.filter((video): video is Video =>
		typeof video?.id === "string" && video.id !== ""
	);
}

/** Ask the content bucket whether an artifact is served. */
async function checkArtifact(
	url: string,
): Promise<{ state: ArtifactState; detail: string }> {
	try {
		const response = await request(url, { method: "HEAD" });
		await response.body?.cancel();
		return {
			state: artifactState(response.status),
			detail: `HTTP ${response.status}`,
		};
	} catch (error) {
		return {
			state: "unknown",
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Commit recorded on generated thumbnails, as the script does. */
async function currentCommit(repositoryDirectory: string): Promise<string> {
	const fromEnvironment = Deno.env.get("GITHUB_SHA");
	if (fromEnvironment) return fromEnvironment;
	const output = await new Deno.Command("git", {
		args: ["rev-parse", "HEAD"],
		cwd: repositoryDirectory,
		stdout: "piped",
		stderr: "piped",
	}).output();
	if (!output.success) {
		throw new Error(
			`git rev-parse failed: ${
				new TextDecoder().decode(output.stderr).trim()
			}; pass commitSha instead`,
		);
	}
	return new TextDecoder().decode(output.stdout).trim();
}

async function readPlan(context: Context): Promise<Plan> {
	const plan = await context.readResource!("plan") as Plan | null;
	if (!plan) throw new Error("No plan: run discover first");
	return plan;
}

/** Behavior definition for backfilling video captions and thumbnails. */
export const behavior = {
	type: "@rawkode/academy/video-artifacts",
	version: "2026.11.11.1",
	globalArguments: GlobalArgsSchema,
	resources: {
		plan: {
			description: "Missing artifacts and the jobs that would produce them",
			schema: PlanSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		trigger: {
			description: "Workflow instances started for the latest plan",
			schema: TriggerSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		verification: {
			description: "Whether the planned artifacts are now served",
			schema: VerificationSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		discover: {
			description:
				"List published videos from the GraphQL gateway, check which lack captions or a thumbnail in the content bucket, and plan one job per missing artifact",
			arguments: z.object({
				videos: z.string().default("")
					.describe(
						"Comma-separated video ids to consider; empty considers every published video",
					),
				kinds: z.string().default("")
					.describe(
						`Comma-separated artifact kinds to check (${
							ARTIFACT_KINDS.join(", ")
						}); empty checks all`,
					),
				maximum: z.number().int().min(0).default(0)
					.describe(
						"Most jobs to plan, newest videos first; 0 plans every missing artifact",
					),
				commitSha: z.string().default("")
					.describe(
						"Commit recorded on generated thumbnails; defaults to GITHUB_SHA, then the repository HEAD",
					),
			}),
			execute: async (
				args: {
					videos: string;
					kinds: string;
					maximum: number;
					commitSha: string;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const kinds = parseKinds(args.kinds);
				const identifiers = parseList(args.videos);
				const invalid = identifiers.filter((id) => !isValidVideoIdentifier(id));
				if (invalid.length > 0) {
					throw new Error(`Invalid video id: ${invalid.join(", ")}`);
				}
				const { contentUrl, apiUrl } = context.globalArgs;
				const { selected, absent } = selectVideos(
					await listVideos(apiUrl),
					identifiers,
				);
				if (absent.length > 0) {
					throw new Error(`No published video for: ${absent.join(", ")}`);
				}
				const commitSha = kinds.includes("thumbnail")
					? args.commitSha || await currentCommit(context.repoDir)
					: "";

				const jobs: Job[] = [];
				const skipped: Skipped[] = [];
				let checked = 0;
				for (
					let start = 0;
					start < selected.length &&
					(args.maximum === 0 || jobs.length < args.maximum);
					start += VIDEOS_PER_ROUND
				) {
					const round = selected.slice(start, start + VIDEOS_PER_ROUND);
					checked += round.length;
					const targets = round.flatMap((video) =>
						kinds.map((kind) => ({ video, kind }))
					);
					const outcomes = await inParallel(
						targets,
						async ({ video, kind }) => {
							if (!isValidVideoIdentifier(video.id)) {
								return planArtifact(video, kind, "unknown", {
									contentUrl,
									commitSha,
									detail: "invalid video id",
								});
							}
							const { state, detail } = await checkArtifact(
								artifactUrl(contentUrl, video, kind),
							);
							return planArtifact(video, kind, state, {
								contentUrl,
								commitSha,
								detail,
							});
						},
					);
					for (const outcome of outcomes) {
						if (outcome && "job" in outcome) jobs.push(outcome.job);
						if (outcome && "skipped" in outcome) skipped.push(outcome.skipped);
					}
				}
				const planned = args.maximum === 0 ? jobs : jobs.slice(0, args.maximum);

				context.logger.info(
					"Checked {checked} of {listed} videos: {jobs} jobs planned, {skipped} skipped",
					{
						checked,
						listed: selected.length,
						jobs: planned.length,
						skipped: skipped.length,
					},
				);
				const handle = await context.writeResource("plan", "plan", {
					createdAt: new Date().toISOString(),
					kinds,
					listed: selected.length,
					checked,
					jobs: planned,
					skipped,
					summary: summarize(planned, skipped, checked),
				});
				return { dataHandles: [handle] };
			},
		},
		trigger: {
			description:
				"Start one Cloudflare Workflow instance per job in the latest plan, the way `wrangler workflows trigger` does",
			arguments: z.object({
				apiToken: z.string().meta({ sensitive: true })
					.describe(
						"Cloudflare API token allowed to run Workflows; wire it with vault.get",
					),
			}),
			execute: async (
				args: { apiToken: string },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const { accountId } = context.globalArgs;
				if (!accountId) {
					throw new Error("Set the accountId global argument to trigger jobs");
				}
				const plan = await readPlan(context);
				if (plan.jobs.length === 0) {
					throw new Error("The latest plan has no jobs to trigger");
				}
				const instances: Array<Record<string, unknown>> = [];
				const failures: Array<Record<string, unknown>> = [];
				// One at a time, as the scripts do, to stay inside the API rate limit.
				for (const [index, job] of plan.jobs.entries()) {
					const artifact = {
						videoId: job.videoId,
						kind: job.kind,
						url: job.url,
						workflow: job.workflow,
					};
					try {
						const { url, body } = instanceRequest(accountId, job);
						const response = await fetch(url, {
							method: "POST",
							headers: {
								authorization: `Bearer ${args.apiToken}`,
								"content-type": "application/json",
							},
							body,
							signal: AbortSignal.timeout(60_000),
						});
						const text = await response.text();
						const instanceId = response.ok
							? (JSON.parse(text) as { result?: { id?: string } }).result?.id
							: undefined;
						if (!instanceId) {
							throw new Error(
								`Cloudflare answered ${response.status}: ${text.slice(0, 300)}`,
							);
						}
						instances.push({ ...artifact, instanceId });
					} catch (error) {
						failures.push({
							...artifact,
							error: error instanceof Error ? error.message : String(error),
						});
					}
					if (index < plan.jobs.length - 1) {
						await new Promise((resolve) =>
							setTimeout(resolve, TRIGGER_PAUSE_MILLISECONDS)
						);
					}
				}
				context.logger.info("Triggered {instances} jobs; {failures} failed", {
					instances: instances.length,
					failures: failures.length,
				});
				const handle = await context.writeResource("trigger", "trigger", {
					triggeredAt: new Date().toISOString(),
					planCreatedAt: plan.createdAt,
					instances,
					failures,
				});
				if (failures.length > 0) {
					throw new Error(
						`Could not trigger ${failures.length} of ${plan.jobs.length} jobs:\n${
							failures.map((failure) =>
								`${failure.videoId} ${failure.kind}: ${failure.error}`
							).join("\n")
						}`,
					);
				}
				return { dataHandles: [handle] };
			},
		},
		verify: {
			description:
				"Wait until every artifact in the latest plan is served by the content bucket, and fail when one still is not",
			arguments: z.object({
				waitMinutes: z.number().min(0).default(30)
					.describe(
						"How long to keep checking before failing; 0 checks once",
					),
				pollSeconds: z.number().min(5).default(30)
					.describe("Pause between rounds of checks"),
			}),
			execute: async (
				args: { waitMinutes: number; pollSeconds: number },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await readPlan(context);
				const deadline = Date.now() + args.waitMinutes * 60_000;
				const present: Array<
					{ videoId: string; kind: ArtifactKind; url: string }
				> = [];
				let outstanding = plan.jobs.map(({ videoId, kind, url }) => ({
					videoId,
					kind,
					url,
					detail: "",
				}));
				while (outstanding.length > 0) {
					const checks = await inParallel(
						outstanding,
						(artifact) => checkArtifact(artifact.url),
					);
					const remaining: typeof outstanding = [];
					for (const [index, artifact] of outstanding.entries()) {
						const { videoId, kind, url } = artifact;
						if (checks[index].state === "present") {
							present.push({ videoId, kind, url });
						} else {
							remaining.push({ ...artifact, detail: checks[index].detail });
						}
					}
					outstanding = remaining;
					context.logger.info("{present} artifacts served, {absent} awaited", {
						present: present.length,
						absent: outstanding.length,
					});
					if (
						outstanding.length === 0 ||
						Date.now() + args.pollSeconds * 1_000 > deadline
					) break;
					await new Promise((resolve) =>
						setTimeout(resolve, args.pollSeconds * 1_000)
					);
				}
				const handle = await context.writeResource(
					"verification",
					"verification",
					{
						verifiedAt: new Date().toISOString(),
						planCreatedAt: plan.createdAt,
						present,
						absent: outstanding,
					},
				);
				if (outstanding.length > 0) {
					throw new Error(
						`${outstanding.length} of ${plan.jobs.length} artifacts are still not served after ${args.waitMinutes} minutes:\n${
							outstanding.map((artifact) =>
								`${artifact.videoId} ${artifact.kind}: ${artifact.url} (${artifact.detail})`
							).join("\n")
						}`,
					);
				}
				return { dataHandles: [handle] };
			},
		},
	},
};
