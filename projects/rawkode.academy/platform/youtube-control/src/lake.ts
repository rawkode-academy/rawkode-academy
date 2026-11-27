import type { AnalyticsReport } from "./analytics.ts";
import type { Video } from "./academy.ts";
import { hash } from "./domain.ts";

// The Academy analytics lake: the observability collector accepts CloudEvents
// over RPC, persists them before acknowledging, and delivers them to Basin
// (`analytics.events_archive` in the `rawkode-analytics` bucket).
export interface AnalyticsCollector {
  trackEvent(event: unknown): Promise<{ success: boolean; error?: string }>;
  trackEvents?(events: unknown[]): Promise<{ success: boolean; error?: string }[]>;
}

export const LAKE_SOURCE = "rawkode-academy-youtube";

// One CloudEvent per report row. The ID covers the exact query, the row's
// dimensions and the fetch time, so a retried send is deduplicated by
// `(source, id)` while a later fetch (YouTube revises recent days) is a new
// observation. Readers keep the latest `fetchedAt` per day/dimension.
export async function reportEvents(report: AnalyticsReport) {
  const metrics = new Set(report.columnHeaders.filter(c => c.columnType === "METRIC").map(c => c.name));
  return Promise.all(report.rows.map(async row => {
    const dimensions = Object.fromEntries(Object.entries(row).filter(([name]) => !metrics.has(name)));
    const id = await hash(JSON.stringify([report.channelId, report.report, report.videoId, report.requestedRange.startDate, report.requestedRange.endDate, dimensions, report.fetchedAt]));
    return {
      specversion: "1.0",
      id,
      source: LAKE_SOURCE,
      type: `youtube.${report.report}`,
      time: report.fetchedAt,
      datacontenttype: "application/json",
      data: {
        channelId: report.channelId,
        report: report.report,
        videoId: report.videoId,
        startDate: report.requestedRange.startDate,
        endDate: report.requestedRange.endDate,
        timeZone: report.requestedRange.timeZone,
        fetchedAt: report.fetchedAt,
        ...row,
      },
    };
  }));
}

// The channel's video catalogue: one `youtube.video` event per upload per
// sync, so per-video rows can be joined to titles (and to the website's
// videos by YouTube ID) even where the website has no YouTube ID stored.
// Readers keep the latest `fetchedAt` per video.
export async function videoEvents(videos: Video[], channelId: string, fetchedAt = new Date().toISOString()) {
  return Promise.all(videos.map(async video => ({
    specversion: "1.0",
    id: await hash(JSON.stringify([channelId, "video", video.videoId, fetchedAt])),
    source: LAKE_SOURCE,
    type: "youtube.video",
    time: fetchedAt,
    datacontenttype: "application/json",
    data: { channelId, report: "video", fetchedAt, video: video.videoId, title: video.title, publishedAt: video.publishedAt },
  })));
}

// Each video's public lifetime view count (the number YouTube shows on the
// watch page), one `youtube.video_stats` event per video per daily
// reconciliation. The Analytics API's per-day views can sum to less than this
// for older videos, so partner analytics never shows a lifetime below it.
// Readers keep the latest `fetchedAt` per video.
export async function videoStatsEvents(counts: Map<string, number>, channelId: string, fetchedAt = new Date().toISOString()) {
  return Promise.all([...counts].map(async ([videoId, viewCount]) => ({
    specversion: "1.0",
    id: await hash(JSON.stringify([channelId, "video_stats", videoId, fetchedAt])),
    source: LAKE_SOURCE,
    type: "youtube.video_stats",
    time: fetchedAt,
    datacontenttype: "application/json",
    data: { channelId, report: "video_stats", fetchedAt, video: videoId, viewCount },
  })));
}

// Channel totals (subscribers, lifetime views, video count) at fetch time:
// one `youtube.channel_stats` event per sync. Unlike the daily reports these
// are point-in-time totals; readers keep the latest `fetchedAt`.
export async function channelStatsEvent(channelId: string, stats: { subscriberCount: number | null; viewCount: number; videoCount: number }, fetchedAt = new Date().toISOString()) {
  return {
    specversion: "1.0",
    id: await hash(JSON.stringify([channelId, "channel_stats", fetchedAt])),
    source: LAKE_SOURCE,
    type: "youtube.channel_stats",
    time: fetchedAt,
    datacontenttype: "application/json",
    data: { channelId, report: "channel_stats", fetchedAt, ...stats },
  };
}

// Delivers events and counts what the collector accepted. A collector that
// takes batches gets 50 events per RPC: one subrequest per batch instead of
// one per event, which kept exhausting the Worker's subrequest limit across a
// long backfill and left most of each step's rows rejected.
export const LAKE_BATCH = 50;
const failure = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "collector_unavailable");

export async function sendEvents(collector: AnalyticsCollector | undefined, events: unknown[], concurrency = 4) {
  if (!collector) return { configured: false, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  const count = (results: { success: boolean; error?: string }[], expected: number) => {
    for (const result of results) {
      if (result.success) sent++;
      else { failed++; lastError = result.error ?? "rejected"; }
    }
    // A short answer means the collector dropped events it never reported on.
    if (results.length < expected) { failed += expected - results.length; lastError = "incomplete_batch"; }
  };
  const batched = typeof collector.trackEvents === "function";
  const groups: unknown[][] = [];
  const size = batched ? LAKE_BATCH : 1;
  for (let i = 0; i < events.length; i += size) groups.push(events.slice(i, i + size));
  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const group = groups[next++]!;
      try {
        count(batched ? await collector.trackEvents!(group) : [await collector.trackEvent(group[0])], group.length);
      } catch (error) {
        failed += group.length;
        lastError = failure(error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, worker));
  return { configured: true, sent, failed, ...(lastError ? { error: lastError } : {}) };
}

export async function sendToLake(collector: AnalyticsCollector | undefined, report: AnalyticsReport) {
  return sendEvents(collector, await reportEvents(report));
}
