import type { APIContext } from "astro";
import { getPublishedVideos } from "@/lib/content";
import { getCollection, setContentCache } from "@/lib/live-content";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";
import { normalizeTechnologyReferences } from "@/utils/normalize-technology-refs";

export const prerender = false;

const escapeAttribute = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

export async function GET(context: APIContext) {
	// Get published videos only (filters out future-dated for scheduled publishing)
	const [sortedVideos, technologies] = await Promise.all([
		getPublishedVideos(),
		getCollection("technologies"),
	]);
	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);
	// Every video and technology appears in the feed; the next scheduled
	// video caps the cache lifetime so it shows up on time.
	await setContentCache(context, {
		collections: ["videos", "technologies"],
	});

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
		const duration =
			typeof video.data.duration === "number" &&
			Number.isFinite(video.data.duration) &&
			video.data.duration > 0
				? video.data.duration
				: undefined;
		const durationContent =
			typeof duration === "number"
				? `<p>Duration: ${Math.floor(duration / 60)}:${(duration % 60)
						.toString()
						.padStart(2, "0")}</p>`
				: "";

		const categories = normalizeTechnologyReferences(video.data.technologies)
			.map((id) => {
				const name = escapeAttribute(techName.get(id) || id);
				return `<category term="${name}" label="${name}"/>`;
			})
			.join("\n\t\t");

		const thumbnailUrl = getVideoThumbnailUrl(video.data.id);
		return `\t<entry>
\t\t<title><![CDATA[${video.data.title}]]></title>
\t\t<link href="${videoUrl}" rel="alternate" type="text/html"/>
\t\t<link href="${thumbnailUrl}" rel="enclosure" type="image/webp"/>
\t\t<id>${videoUrl}</id>
\t\t<published>${published}</published>
\t\t<updated>${published}</updated>
\t\t<summary><![CDATA[${video.data.description}]]></summary>
\t\t<content type="html"><![CDATA[
\t\t\t<img src="${thumbnailUrl}" alt="${video.data.title}" />
\t\t\t<p>${video.data.description}</p>
\t\t\t${durationContent}
\t\t]]></content>
\t\t${categories}
\t</entry>`;
	})
	.join("\n")}
</feed>`;

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
