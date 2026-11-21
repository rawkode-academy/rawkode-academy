import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { analyticsSchema } from "./analytics.ts";
import { sessionSchema, videoId } from "./domain.ts";
import type { Operation, Outcome } from "./channel.ts";

export function createServer(invoke: (operation: Operation, input: unknown) => Promise<Outcome>, canWrite: boolean) {
  const server = new McpServer({ name: "rawkode-academy-youtube", version: "0.1.0" });
  const run = async (operation: Operation, input: unknown) => {
    const result = await invoke(operation, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result.ok ? result.value : result.error) }], isError: !result.ok };
  };
  server.registerTool("plan_session", {
    description: "Prepare the exact changes to an upcoming Rawkode Academy YouTube broadcast. Returns a 15-minute planId and full proposed content; does not publish. Use a stable Academy sessionId. Review the returned plan before applying.",
    inputSchema: sessionSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  }, input => run("plan", input));
  if (canWrite) server.registerTool("apply_session", {
    description: "Publish the exact previously reviewed plan. May create a public YouTube broadcast or change its title, description, time, thumbnail or encoder binding. Does not start a stream. Requires the planId returned by plan_session.",
    inputSchema: z.object({ planId: z.uuid() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, input => run("apply", input));
  server.registerTool("get_broadcast", {
    description: "Read the current broadcast metadata from the configured channel. No stream keys are returned.",
    inputSchema: z.object({ broadcastId: videoId }).strict(),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, input => run("broadcast", input));
  server.registerTool("get_analytics", {
    description: "Retrieve owned YouTube channel/video analytics: summary, daily, top_videos, traffic, retention or concurrent_viewers. Dates use America/Los_Angeles, 1–92 days inclusive. Retention/concurrent reports require videoId. Returns the latest stored Basin snapshot with its age, or fetches YouTube when absent. Set refresh=true to fetch and archive a fresh report. Missing rows are unknown, never zeros. Top-video rows are not channel totals.",
    inputSchema: analyticsSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, input => run("analytics", input));
  return server;
}
