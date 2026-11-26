export interface Env {
	// Audit trail of updates (this service's own database).
	DB: D1Database;
	// The platform services' databases this Worker writes, one atomic batch each.
	VIDEOS: D1Database;
	PEOPLE: D1Database;
	PEOPLE_LINKS: D1Database;
	TECHNOLOGIES: D1Database;
	SHOWS: D1Database;
	EPISODES: D1Database;
	COURSES: D1Database;
	CASTING_CREDITS: D1Database;
	VIDEO_GUESTS: D1Database;
	VIDEO_TECHNOLOGIES: D1Database;
	CHAPTERS: D1Database;
	VIDEO_COLLABORATIONS: D1Database;
	VIDEO_CHANNELS: D1Database;
	// Published once an update is committed; the YouTube sync consumes it.
	VIDEO_UPDATED: Queue<VideoUpdatedEvent>;
	UPDATE_VIDEO: Workflow;
	ANALYTICS: Service;
	// Bearer token of the website's cache invalidation endpoint.
	CACHE_INVALIDATION_TOKEN: string;
	SITE_ORIGIN: string;
}

// The contract with the YouTube sync (and any later consumer).
export type VideoUpdatedEvent = {
	type: "video.updated";
	version: 1;
	videoId: string;
	updateId: string;
	at: string;
	sections: string[];
};
