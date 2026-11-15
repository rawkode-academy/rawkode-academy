import type { APIRoute } from "astro";
import { getCollection } from "@/lib/live-content";
import { getPublishedVideos, getUpcomingVideos } from "@/lib/content";

export const prerender = false;

/** Mobile catalog; only published lessons are exposed. */
export const GET: APIRoute = async () => {
  try {
    const [courses, modules, published, upcoming] = await Promise.all([
      getCollection("courses"), getCollection("courseModules"), getPublishedVideos(), getUpcomingVideos(),
    ]);
    const videos = [...published, ...upcoming];
    const body = {
      courses: courses.filter((course) => course.data.publishedAt.getTime() <= Date.now()).map((course) => ({
        id: course.id, title: course.data.title, description: course.data.description,
        difficulty: course.data.difficulty,
        lessons: modules.filter((module) => module.data.course.id === course.id && !module.data.draft && module.data.publishedAt.getTime() <= Date.now())
          .sort((a, b) => a.data.order - b.data.order)
          .map((module) => ({ id: module.id, title: module.data.title, description: module.data.description, videoId: module.data.video?.id ?? null, body: module.data.body ?? null })),
      })),
      videos: videos.map((video) => ({
        id: video.data.id, slug: video.data.slug, title: video.data.title,
        description: video.data.description, publishedAt: video.data.publishedAt,
        type: video.data.type, youtubeId: video.data.youtubeId ?? null,
      })),
    };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
  } catch {
    return new Response(JSON.stringify({ error: "Catalog unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
};
