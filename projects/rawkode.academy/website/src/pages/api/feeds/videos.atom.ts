import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
	const videos = await getCollection("videos");

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
		const durationMinutes = Math.floor(video.data.duration / 60);
		const durationSeconds = video.data.duration % 60;
		const formattedDuration = `${durationMinutes}:${durationSeconds
			.toString()
			.padStart(2, "0")}`;

		return `	<entry>
		<title><![CDATA[${video.data.title}]]></title>
		<link href="${videoUrl}" rel="alternate" type="text/html"/>
		<link href="${video.data.thumbnailUrl}" rel="enclosure" type="image/jpeg"/>
		<id>${videoUrl}</id>
		<published>${published}</published>
		<updated>${published}</updated>
		<summary><![CDATA[${video.data.description}]]></summary>
		<content type="html"><![CDATA[
			<img src="${video.data.thumbnailUrl}" alt="${video.data.title}" />
			<p>${video.data.description}</p>
			<p>Duration: ${formattedDuration}</p>
		]]></content>
		${video.data.technologies
			.map((tech) => `<category term="${tech.name}" label="${tech.name}"/>`)
			.join("\n\t\t")}
	</entry>`;
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
