import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { read, reply, type ToolModule } from "./module.ts";

// What the video-updates Worker's `VideoUpdates` entrypoint offers. The Worker
// validates every request itself; the schemas here only describe the tools.
export interface VideoUpdatesRpc {
  preview(request: unknown): Promise<{ sections: string[]; errors: string[] }>;
  update(request: unknown, actor: { userId: string; username?: string }): Promise<{ updateId: string; sections: string[]; duplicate: boolean }>;
  status(updateId: string): Promise<unknown>;
  schedule(request: unknown, actor: { userId: string; username?: string }): Promise<{ updateId: string; videoId: string; sections: string[]; duplicate: boolean }>;
}

const id = z.string().min(1).max(200);
const resource = z.object({ title: z.string(), description: z.string().optional(), type: z.enum(["url", "file", "embed"]), url: z.string().optional(), category: z.enum(["slides", "code", "documentation", "demos", "other"]) });
export const updateInput = z.object({
  videoId: id.describe("The Academy video id (a cuid), not the YouTube id."),
  requestId: z.string().min(8).max(100).optional().describe("Retrying with the same key returns the same update instead of making another."),
  video: z.object({
    title: z.string().optional(), subtitle: z.string().nullable().optional(), tagline: z.string().nullable().optional(), slug: z.string().optional(),
    description: z.string().optional().describe("Markdown. The rich-text document is generated from it."),
    whatYouWillLearn: z.array(z.string()).nullable().optional(),
    publishedAt: z.string().optional().describe("ISO 8601 date-time"),
    type: z.enum(["live", "recorded"]).nullable().optional(),
    category: z.enum(["editorial", "tutorial", "review", "interview", "announcement"]).nullable().optional(),
    courseOnly: z.boolean().optional(),
    resources: z.array(resource).nullable().optional().describe("Links and downloads shown with the video."),
  }).strict().optional().describe("Only the fields you give change."),
  people: z.array(z.object({ id, forename: z.string().optional(), surname: z.string().optional(), name: z.string().optional(), github: z.string().nullable().optional(), twitter: z.string().nullable().optional(), bluesky: z.string().nullable().optional(), linkedin: z.string().nullable().optional(), mastodon: z.string().nullable().optional(), website: z.string().nullable().optional(), youtube: z.string().nullable().optional(), links: z.array(z.object({ url: z.string(), name: z.string() })).optional() }).strict()).optional().describe("Create or update people. A new person needs forename and surname."),
  credits: z.array(z.object({ personId: id, role: z.enum(["host", "co_host", "guest", "author"]) })).optional().describe("Replaces the video's casting credits, in order."),
  technologies: z.array(id).optional().describe("Replaces the video's technologies, in order."),
  chapters: z.array(z.object({ seconds: z.number().int().min(0), title: z.string() })).optional().describe("Replaces the video's chapters."),
  show: z.object({ showId: id, code: z.string() }).nullable().optional().describe("The show episode this video is, or null to remove it from its show."),
  courseModule: z.string().nullable().optional().describe("The lesson, <course id>/<module slug>, this video plays in, or null to remove it."),
  collaborations: z.array(z.object({ collaboratorId: id, startsAt: z.string().nullable().optional(), endsAt: z.string().nullable().optional(), ctaLink: z.string().nullable().optional() })).optional().describe("Replaces the video's collaborations."),
  channels: z.array(z.object({ platform: z.enum(["youtube", "x", "linkedin"]), externalId: z.string() })).optional().describe("Where the video lives on other platforms."),
}).strict();

export const scheduleInput = updateInput.omit({ videoId: true }).extend({
  privacy: z.enum(["public", "unlisted", "private"]).default("public").describe("Who can see the YouTube broadcast. Use private for a test."),
  thumbnailBrief: z.string().max(500).optional().describe("What the picture on the generated thumbnail should show, in words. It is abstract art: the model is told to draw no logos."),
  thumbnailHook: z.string().max(30).optional().describe("The few words written large on the thumbnail, readable at phone size (for example BACK UP EVERYTHING). Defaults to the first technology's name."),
  thumbnailLogos: z.array(z.string()).max(3).optional().describe("Technology ids whose official logo is added to the thumbnail (technologies/<id>/horizontal.svg). The Academy's wordmark is always added. Logos are composited from the real files, never drawn by the model."),
}).strict();

// Changes an Academy video and everything attached to it, through the
// video-updates Workflow. Operators only, and only when asked for by name.
export const video: ToolModule = {
  scope: "video:write",
  audience: "operator",
  readOnly: false,
  description: "change Rawkode Academy videos: their details, links, people and credits, technologies, chapters, show, course lesson and collaborations, and push the result to YouTube",
  register(server: McpServer, env: CloudflareEnv, caller) {
    const rpc = () => (env as unknown as { VIDEO_UPDATES: VideoUpdatesRpc }).VIDEO_UPDATES;
    server.registerTool("preview_video_update", {
      description: "Check a video update without writing anything: which sections it would change and anything that would make it fail (a missing person, technology, show or collaborator, a taken slug or episode code).",
      inputSchema: updateInput,
      annotations: read,
    }, input => reply(() => rpc().preview(input)));
    server.registerTool("update_video", {
      description: "Update a video and everything attached to it in one operation. Sections you leave out are untouched; lists you give replace what is stored. The databases are written one after another and put back if any step fails. When it succeeds YouTube is updated shortly after (title, description, thumbnail). Returns an updateId; poll video_update_status.",
      inputSchema: updateInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, input => reply(() => rpc().update(input, { userId: caller.userId, username: caller.username })));
    server.registerTool("schedule_live_stream", {
      description: "Schedule a new live stream in one operation: create the video (title, slug, description, publishedAt as the start time, type live) with its show, people, credits and technologies, generate its thumbnail with GPT Image, and create the YouTube broadcast (auto-start on, ultra low latency, bound to the channel's stream key) with the same title, description and thumbnail. The start must be at least 10 minutes away. Use preview_video_update-style validation first by giving the same fields to this tool; it rejects without writing anything if a reference is missing. Returns the new videoId and an updateId; poll video_update_status.",
      inputSchema: scheduleInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, ({ privacy, ...rest }) => reply(() => rpc().schedule({ ...rest, broadcast: { privacy } }, { userId: caller.userId, username: caller.username })));
    server.registerTool("video_update_status", {
      description: "The state of a video update: queued, running, succeeded, rejected (nothing written), rolled_back, or rollback_failed (needs a person), and whether the YouTube event and the website cache invalidation went through.",
      inputSchema: z.object({ updateId: id }).strict(),
      annotations: read,
    }, ({ updateId }) => reply(async () => (await rpc().status(updateId)) ?? { error: "not_found" }));
  },
};
