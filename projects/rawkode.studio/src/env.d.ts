/// <reference path="../.astro/types.d.ts" />
/// <reference types="@astrojs/cloudflare" />

type StudioUser = {
	id: string;
	email: string;
	name: string;
	image: string | null;
	identity?: unknown;
};

declare namespace App {
	interface Locals {
		user?: StudioUser;
	}
}

interface ImportMetaEnv {
	readonly PUBLIC_STUDIO_DEFAULT_EVENT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface StudioBindings {
	SESSION: KVNamespace;
		LIVE_EVENTS: KVNamespace;
		CLOUDFLARE_ACCOUNT_ID?: string;
		CLOUDFLARE_STREAM_API_TOKEN?: string;
		CLOUDFLARE_REALTIME_APP_ID?: string;
		CLOUDFLARE_REALTIME_APP_SECRET?: string;
		YOUTUBE_RTMP_URL?: string;
	YOUTUBE_STREAM_KEY?: string;
	TWITCH_RTMP_URL?: string;
	TWITCH_STREAM_KEY?: string;
	LINKEDIN_RTMP_URL?: string;
	LINKEDIN_STREAM_KEY?: string;
}

interface Env extends StudioBindings {}

declare namespace Cloudflare {
	interface Env extends StudioBindings {}
}
