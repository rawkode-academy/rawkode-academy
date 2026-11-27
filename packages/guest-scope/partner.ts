// Per-video numbers for a partner's collaboration videos, from the website's
// daily analytics snapshot. Shared by the video-collaborations subgraph (which
// serves them over GraphQL) and the website's /analytics, so both show a
// partner the same figures. Aggregates only: human page views with bots
// excluded, and YouTube views and watch time. Nothing about any person. No
// imports, like the rest of this package.

export type Period = { d90: number; lifetime: number };
export type AnalyticsSnapshot = {
  generatedAt: string;
  videos?: Record<string, { views: Period; minutes: Period }>;
  academy?: { id: string; title: string; slug: string; youtube: string | null; lesson?: string | null }[];
  watch?: Record<string, Period>;
};
export type VideoAnalytics = {
  id: string;
  title: string;
  slug: string;
  siteViews: Period;
  /** Null when the video can't be tied to one YouTube video with certainty. */
  youtubeViews: Period | null;
  minutesWatched: Period | null;
};
export type CollaboratorAnalytics = {
  generatedAt: string;
  siteViews: Period;
  youtubeViews: Period;
  minutesWatched: Period;
  videos: VideoAnalytics[];
};

const add = (a: Period, b: Period): Period => ({ d90: a.d90 + b.d90, lifetime: a.lifetime + b.lifetime });
const none = (): Period => ({ d90: 0, lifetime: 0 });
const reach = (video: VideoAnalytics) => video.siteViews.lifetime + (video.youtubeViews?.lifetime ?? 0);

export function analyticsFor(snapshot: AnalyticsSnapshot, videoIds: readonly string[]): CollaboratorAnalytics {
  const academy = new Map((snapshot.academy ?? []).map(video => [video.id, video]));
  const result: CollaboratorAnalytics = {
    generatedAt: snapshot.generatedAt,
    siteViews: none(),
    youtubeViews: none(),
    minutesWatched: none(),
    videos: [],
  };
  for (const id of videoIds) {
    const video = academy.get(id);
    if (!video) continue;
    // A video is watched at /watch/<slug>, or as a course lesson page.
    const site = add(snapshot.watch?.[video.slug] ?? none(), (video.lesson && snapshot.watch?.[video.lesson]) || none());
    const youtube = video.youtube ? snapshot.videos?.[video.youtube] : undefined;
    result.videos.push({ id, title: video.title, slug: video.slug, siteViews: site, youtubeViews: youtube?.views ?? null, minutesWatched: youtube?.minutes ?? null });
    result.siteViews = add(result.siteViews, site);
    if (youtube) {
      result.youtubeViews = add(result.youtubeViews, youtube.views);
      result.minutesWatched = add(result.minutesWatched, youtube.minutes);
    }
  }
  result.videos.sort((a, b) => reach(b) - reach(a));
  return result;
}
