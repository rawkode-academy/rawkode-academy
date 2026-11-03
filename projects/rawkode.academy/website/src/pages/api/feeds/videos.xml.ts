import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedVideos } from "@/lib/content";
import { getCollection, setContentCache } from "@/lib/live-content";
import { getVideoThumbnailJpegUrl } from "@/lib/video-thumbnail";
import { normalizeTechnologyReferences } from "@/utils/normalize-technology-refs";
import { withRssMimeType } from "../../../lib/feed-utils";

export const prerender = false;

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
					typeof video.data.duration === "number" &&
					Number.isFinite(video.data.duration) &&
					video.data.duration > 0
						? video.data.duration
						: undefined;
				const durationTag =
					typeof duration === "number"
						? `<itunes:duration>${Math.floor(duration / 60)}:${(duration % 60)
								.toString()
								.padStart(2, "0")}</itunes:duration>`
						: "";
				const itunesImageUrl = getVideoThumbnailJpegUrl(site, video.data.id);
				return {
					title: video.data.title,
					description: video.data.description,
					pubDate: new Date(video.data.publishedAt),
					link: `/watch/${video.data.slug}/`,
					customData: `
						<enclosure url="${itunesImageUrl}" type="image/jpeg" />
						${durationTag}
						<itunes:image href="${itunesImageUrl}" />
					`,
					categories: normalizeTechnologyReferences(
						video.data.technologies,
					).map((id) => techName.get(id) || id),
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
