import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
	const videos = await getCollection("videos");

	// Sort by publishedAt desc
	const sortedVideos = videos.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	return rss({
		title: "Rawkode Academy - Videos",
		description:
			"Latest videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
		site: context.site?.toString() || "https://rawkode.academy",
		items: sortedVideos.map((video) => ({
			title: video.data.title,
			description: video.data.description,
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.data.slug}/`,
			customData: `
				<enclosure url="${video.data.thumbnailUrl}" type="image/jpeg" />
				<itunes:duration>${Math.floor(video.data.duration / 60)}:${(
					video.data.duration % 60
				)
					.toString()
					.padStart(2, "0")}</itunes:duration>
				<itunes:image href="${video.data.thumbnailUrl}" />
			`,
			categories: video.data.technologies.map((tech) => tech.name),
		})),
		customData: `<language>en-us</language>`,
		stylesheet: false,
		xmlns: {
			itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
		},
	});
}
