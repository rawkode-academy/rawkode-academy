import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
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

	return rss({
		title: "Rawkode Academy - Videos",
		description:
			"Latest videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
		site: context.site?.toString() || "https://rawkode.academy",
		items: sortedVideos.map((video) => {
			const duration =
				typeof video.data.duration === "number"
					? video.data.duration
					: 0;
			return {
				title: video.data.title,
				description: video.data.description,
				pubDate: new Date(video.data.publishedAt),
				link: `/watch/${video.data.slug}/`,
				customData: `
					<enclosure url="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" type="image/jpeg" />
					<itunes:duration>${Math.floor(duration / 60)}:${(
						duration % 60
					)
						.toString()
						.padStart(2, "0")}</itunes:duration>
					<itunes:image href="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" />
				`,
				categories: (video.data.technologies as string[])
					.map((id) => {
						// Handle both string IDs and reference objects
						const techId = typeof id === 'string' ? id : (id as any).id || id;
						const normalizedId = techId.endsWith?.('/index') ? techId.slice(0, -6) : techId;
						return techName.get(normalizedId + '/index') || techName.get(normalizedId) || normalizedId;
					})
					.filter((cat) => cat !== null && cat !== undefined && typeof cat === 'string'),
			};
		}),
		customData: "<language>en-us</language>",
		stylesheet: false,
		xmlns: {
			itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
		},
	});
}
