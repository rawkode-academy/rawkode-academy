import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { basinConfig, basinQuery } from "../basin.ts";
import { daySchema, ensure } from "../errors.ts";
import { episodesFor, guestDailySql } from "../guest.ts";
import { read, reply, type ToolModule } from "./module.ts";

const range = z.object({ startDate: daySchema, endDate: daySchema, videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional() }).strict()
  .refine(r => r.startDate <= r.endDate && Date.parse(r.endDate) - Date.parse(r.startDate) < 500 * 86400000, "Use startDate <= endDate, at most 500 days apart");

// Fixed, read-only views of one person's own episodes. There is no SQL tool:
// the person's GitHub username comes from the verified sign-in, the episodes
// from the Academy's video list, and every query is built from those.
export const guest: ToolModule = {
  scope: "guest:read",
  audience: "guest",
  readOnly: true,
  description: "read YouTube numbers for the Rawkode Academy episodes you appear in (as a guest, or as a host of the show)",
  register(server: McpServer, env: CloudflareEnv, caller) {
    const basin = basinConfig(env);
    const username = caller.username ?? "";
    const tracked = async () => {
      ensure(username, "forbidden", "No verified GitHub username for this account", 403);
      const { episodes } = await episodesFor(username, basin);
      return episodes;
    };
    server.registerTool("my_episodes", {
      description: "List the Rawkode Academy episodes you appear in: guest appearances, and every episode of a show you host. Each has its YouTube video ID, or null when it can't be tied to exactly one YouTube video yet (those have no numbers).",
      inputSchema: z.object({}).strict(),
      annotations: read,
    }, () => reply(async () => {
      const episodes = await tracked();
      return {
        episodes: episodes.map(({ id: _id, youtubeId: _stored, ...episode }) => episode).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
        withoutYouTubeNumbers: episodes.filter(episode => !episode.youtubeVideoId).length,
      };
    }));
    server.registerTool("my_episode_daily", {
      description: "YouTube numbers per day for your episodes (views, watch minutes, average view duration and percentage, likes, comments, shares, subscribers gained and lost; likes, comments and shares are net and can be negative) for an inclusive date range of at most 500 days, optionally for one YouTube video ID from my_episodes. At most 500 rows; narrow the dates or pick one video if truncated. Days are America/Los_Angeles and lag about three days.",
      inputSchema: range,
      annotations: read,
    }, ({ startDate, endDate, videoId }) => reply(async () => {
      const mine = (await tracked()).filter(episode => episode.youtubeVideoId);
      if (videoId) ensure(mine.some(episode => episode.youtubeVideoId === videoId), "forbidden", "That video isn't one of your episodes", 403);
      const ids = videoId ? [videoId] : mine.map(episode => episode.youtubeVideoId!);
      if (ids.length === 0) return { rows: [], rowCount: 0, truncated: false };
      const titles = new Map(mine.map(episode => [episode.youtubeVideoId!, episode.title]));
      const result = await basinQuery(basin, guestDailySql(ids, startDate, endDate));
      return { ...result, rows: result.rows.map(row => ({ title: titles.get(String(row.video)) ?? null, ...row })) };
    }));
  },
};
