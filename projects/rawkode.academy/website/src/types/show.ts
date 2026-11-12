import type { RemoteImage } from "@/lib/live-content/types";

export type ShowStatus = "coming-soon" | "active" | "archived";

export interface ShowHost {
	forename?: string | null;
	surname?: string | null;
}

export interface ShowEpisode {
	video?: {
		title?: string | null;
		thumbnailUrl?: string | null;
		publishedAt?: string | null;
	} | null;
}

export interface ShowSummary {
	id: string;
	name: string;
	status: ShowStatus;
	tagline?: string | null | undefined;
	gameFormatUrl?: string | null | undefined;
	hosts?: ShowHost[] | null;
	episodes?: (ShowEpisode | null)[] | null;
	cover?:
		| {
				image: RemoteImage;
				alt: string;
		  }
		| null
		| undefined;
}
