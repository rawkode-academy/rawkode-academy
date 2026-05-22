import { getCollection } from "astro:content";
import { getPublishedVideos } from "@/lib/content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../lib/feed-utils";
import { getVideoThumbnailJpegUrl } from "@/lib/video-thumbnail";

export async function GET(context: APIContext) {
	// Get published videos only (filters out future-dated for scheduled publishing)
	const sortedVideos = await getPublishedVideos();
	const technologies = await getCollection("technologies");
	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	const site = (context.site?.toString() || "https://rawkode.academy").replace(
		/\/$/,
		"",
	);

	return withRssMimeType(
		await rss({
			title: "Rawkode Academy - Videos",
			description:
				"Latest videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
			site,
			items: sortedVideos.map((video) => {
				const duration =
					typeof video.data.duration === "number" ? video.data.duration : 0;
				const itunesImageUrl = getVideoThumbnailJpegUrl(site, video.data.id);
				return {
					title: video.data.title,
					description: video.data.description,
					pubDate: new Date(video.data.publishedAt),
					link: `/watch/${video.data.slug}/`,
					customData: `
						<enclosure url="${itunesImageUrl}" type="image/jpeg" />
						<itunes:duration>${Math.floor(duration / 60)}:${(duration % 60)
							.toString()
							.padStart(2, "0")}</itunes:duration>
						<itunes:image href="${itunesImageUrl}" />
					`,
					categories: (video.data.technologies as string[])
						.map((id) => {
							// Handle both string IDs and reference objects
							const techId = typeof id === "string" ? id : (id as any).id || id;
							const normalizedId = techId.endsWith?.("/index")
								? techId.slice(0, -6)
								: techId;
							return (
								techName.get(normalizedId + "/index") ||
								techName.get(normalizedId) ||
								normalizedId
							);
						})
						.filter(
							(cat) =>
								cat !== null && cat !== undefined && typeof cat === "string",
						),
				};
			}),
			customData: "<language>en-us</language>",
			stylesheet: false,
			xmlns: {
				itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
			},
		}),
	);
}
