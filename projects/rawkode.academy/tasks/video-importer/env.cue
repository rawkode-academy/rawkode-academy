package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-task-video-importer"

env: {
	VIDEOS_ENDPOINT:    "https://0aeb879de8e3cdde5fb3d413025222ce.eu.r2.cloudflarestorage.com"
	VIDEOS_BUCKET:      "rawkode-academy-videos"
	CONTENT_ENDPOINT:   "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
	CONTENT_BUCKET:     "rawkode-academy-content"
	CLOUDFLARE_ZONE_ID: "789be9a4588576db675cc2053ea3a89d"
	// platform-videos D1 is written through the Cloudflare D1 HTTP API.
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	environment: production: {
		CONTENT_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/access-key-id"
		}
		CONTENT_SECRET_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/secret-access-key"
		}
		// Needs D1 edit on platform-videos (same token the platform services deploy with).
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
		// The website's CACHE_INVALIDATION_TOKEN secret (POST /api/cache/invalidate).
		// Optional: without it the importer warns and skips invalidation.
		CACHE_INVALIDATION_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/website-cache-invalidation/password"
		}
	}
}

tasks: {
	run: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "start"]
	}
}
