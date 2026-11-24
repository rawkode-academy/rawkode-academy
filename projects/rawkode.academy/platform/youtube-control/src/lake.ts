import type { AnalyticsReport } from "./analytics.ts";
import type { Video } from "./academy.ts";
import { hash } from "./domain.ts";

// The Academy analytics lake: the observability collector accepts CloudEvents
// over RPC, persists them before acknowledging, and delivers them to Basin
// (`analytics.events_archive` in the `rawkode-analytics` bucket).
export interface AnalyticsCollector {
  trackEvent(event: unknown): Promise<{ success: boolean; error?: string }>;
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

// Sends events with bounded concurrency; counts what the collector accepted.
export async function sendEvents(collector: AnalyticsCollector | undefined, events: unknown[], concurrency = 16) {
  if (!collector) return { configured: false, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  let next = 0;
  const worker = async () => {
    while (next < events.length) {
      const event = events[next++];
      try {
        const result = await collector.trackEvent(event);
        if (result.success) sent++;
        else { failed++; lastError = result.error ?? "rejected"; }
      } catch (error) {
        failed++;
        lastError = error instanceof Error ? error.name : "collector_unavailable";
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, events.length) }, worker));
  return { configured: true, sent, failed, ...(lastError ? { error: lastError } : {}) };
}

export async function sendToLake(collector: AnalyticsCollector | undefined, report: AnalyticsReport) {
  return sendEvents(collector, await reportEvents(report));
}
