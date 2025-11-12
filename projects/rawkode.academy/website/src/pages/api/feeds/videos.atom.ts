import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const videos = await getCollection("videos");
  const technologies = await getCollection("technologies");
  const techName = new Map(technologies.map((t) => [t.id, t.data.name] as const));

  // Sort by publishedAt desc
  const sortedVideos = videos.sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime(),
  );

  const site = context.site?.toString() || "https://rawkode.academy";
  const feedUrl = `${site}/api/feeds/videos.atom`;

  // Get the most recent update time
  const lastUpdated =
    sortedVideos.length > 0
      ? new Date(sortedVideos[0]?.data.publishedAt || new Date()).toISOString()
      : new Date().toISOString();

const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Rawkode Academy - Videos</title>
  <subtitle>Latest videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development</subtitle>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <link href="${site}" rel="alternate" type="text/html"/>
  <id>${site}/</id>
  <updated>${lastUpdated}</updated>
  <generator>Astro</generator>
${sortedVideos
  .map((video) => {
    const videoUrl = `${site}/watch/${video.data.slug}/`;
    const published = new Date(video.data.publishedAt).toISOString();
    const dur = typeof video.data.duration === "number" ? video.data.duration : 0;
    const durationMinutes = Math.floor(dur / 60);
    const durationSeconds = dur % 60;
    const formattedDuration = `${durationMinutes}:${durationSeconds
      .toString()
      .padStart(2, "0")}`;

    const categories = ((video.data.technologies as string[]) || [])
      .map((id) => {
        const name = techName.get(id) || id;
        return `<category term=\"${name}\" label=\"${name}\"/>`;
      })
      .join("\\n\\t\\t");

    return `\t<entry>
\t\t<title><![CDATA[${video.data.title}]]></title>
\t\t<link href="${videoUrl}" rel="alternate" type="text/html"/>
\t\t<link href="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" rel="enclosure" type="image/jpeg"/>
\t\t<id>${videoUrl}</id>
\t\t<published>${published}</published>
\t\t<updated>${published}</updated>
\t\t<summary><![CDATA[${video.data.description}]]></summary>
\t\t<content type="html"><![CDATA[
\t\t\t<img src="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" alt="${video.data.title}" />
\t\t\t<p>${video.data.description}</p>
\t\t\t<p>Duration: ${formattedDuration}</p>
\t\t]]></content>
\t\t${categories}
\t</entry>`;
  })
  .join("\n")}
</feed>`;

  return new Response(atomFeed, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "max-age=3600",
    },
  });
}
