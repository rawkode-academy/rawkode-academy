import { getCollection, getEntries } from "astro:content";
import type { APIContext } from "astro";

export async function getStaticPaths() {
	const shows = await getCollection("shows");
	return shows
		.filter((show) => show.data.publish)
		.map((show) => ({ params: { showId: show.data.id } }));
}

export async function GET(context: APIContext) {
	const { showId } = context.params;
	const site = context.site?.toString() || "https://rawkode.academy";

	const shows = await getCollection("shows");
	const show = shows.find((s) => s.data.id === showId);

	if (!show || !show.data.publish) {
		return new Response("Show not found or not published", { status: 404 });
	}

	const videos = await getCollection("videos");
	const showVideos = videos
		.filter((video) => {
			const videoShow = video.data.show;
			if (!videoShow) return false;
			const showRef = typeof videoShow === "string" ? videoShow : videoShow.id;
			return showRef === showId;
		})
		.sort(
			(a, b) =>
				new Date(b.data.publishedAt).getTime() -
				new Date(a.data.publishedAt).getTime(),
		);

	const hostEntries = await getEntries(show.data.hosts);
	const hostNames = hostEntries
		.map((host) => host.data.name)
		.filter(Boolean)
		.join(", ");

	const podcastConfig = show.data.podcast;
	const showDescription =
		show.data.description || `Episodes from ${show.data.name}`;
	const feedUrl = `${site}/api/feeds/shows/${showId}.xml`;
	const showLink = `${site}/shows/${showId}`;

	const firstVideo = showVideos[0];
	const lastBuildDate = firstVideo
		? new Date(firstVideo.data.publishedAt).toUTCString()
		: new Date().toUTCString();

	const escapeXml = (str: string): string => {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	};

	const formatDuration = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
		}
		return `${minutes}:${secs.toString().padStart(2, "0")}`;
	};

	const items = showVideos.map((video, index) => {
		const episodeNumber = showVideos.length - index;
		const duration =
			typeof video.data.duration === "number" ? video.data.duration : 0;
		const audioUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/audio.mp3`;
		const thumbnailUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`;
		const episodeUrl = `${site}/watch/${video.data.slug}/`;
		const pubDate = new Date(video.data.publishedAt).toUTCString();

		return `    <item>
      <title><![CDATA[${video.data.title}]]></title>
      <link>${episodeUrl}</link>
      <description><![CDATA[${video.data.description}]]></description>
      <guid isPermaLink="false">${video.data.videoId}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${audioUrl}" type="audio/mpeg" length="0"/>
      <itunes:title><![CDATA[${video.data.title}]]></itunes:title>
      <itunes:episode>${episodeNumber}</itunes:episode>
      <itunes:duration>${formatDuration(duration)}</itunes:duration>
      <itunes:image href="${thumbnailUrl}"/>
      <itunes:explicit>${podcastConfig?.explicit ? "true" : "false"}</itunes:explicit>
      <itunes:author>${escapeXml(hostNames)}</itunes:author>
    </item>`;
	});

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${show.data.name}]]></title>
    <link>${showLink}</link>
    <description><![CDATA[${showDescription}]]></description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <itunes:author>${escapeXml(hostNames)}</itunes:author>
    <itunes:owner>
      <itunes:name><![CDATA[${hostNames}]]></itunes:name>
      ${podcastConfig?.email ? `<itunes:email>${escapeXml(podcastConfig.email)}</itunes:email>` : ""}
    </itunes:owner>
    <itunes:explicit>${podcastConfig?.explicit ? "true" : "false"}</itunes:explicit>
    ${podcastConfig?.category ? `<itunes:category text="${escapeXml(podcastConfig.category)}"${podcastConfig.subcategory ? `><itunes:category text="${escapeXml(podcastConfig.subcategory)}"/></itunes:category>` : "/>"}` : ""}
    ${podcastConfig?.copyright ? `<copyright>${escapeXml(podcastConfig.copyright)}</copyright>` : ""}
    <generator>Rawkode Academy</generator>
${items.join("\n")}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "max-age=3600",
		},
	});
}
