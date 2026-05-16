/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<{
	ASSETS: Fetcher;
}>;

declare namespace App {
	interface Locals extends Runtime {}
}
