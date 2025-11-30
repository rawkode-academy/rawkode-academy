/// <reference types="@cloudflare/workers-types" />

export interface Env {
	// Subgraph service bindings
	VIDEOS: Fetcher;
	EPISODES: Fetcher;
	PEOPLE: Fetcher;
	SHOWS: Fetcher;
	EMOJI_REACTIONS: Fetcher;
	CASTING_CREDITS: Fetcher;
	CHAPTERS: Fetcher;
	PEOPLE_BIOGRAPHIES: Fetcher;
	PEOPLE_LINKS: Fetcher;
	SHOW_HOSTS: Fetcher;
	TRANSCRIPTION_TERMS: Fetcher;
	VIDEO_GUESTS: Fetcher;
	VIDEO_LIKES: Fetcher;
	VIDEO_TECHNOLOGIES: Fetcher;
	EMAIL_PREFERENCES: Fetcher;
	// Identity service for auth validation
	IDENTITY: Fetcher;
}
