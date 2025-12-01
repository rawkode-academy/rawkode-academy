package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

hooks: onEnter: nix: schema.#NixFlake

env: {
	VIDEOS_ENDPOINT:    "https://0aeb879de8e3cdde5fb3d413025222ce.eu.r2.cloudflarestorage.com"
	VIDEOS_BUCKET:      "rawkode-academy-videos"
	CONTENT_ENDPOINT:   "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
	CONTENT_BUCKET:     "rawkode-academy-content"
	CLOUDFLARE_ZONE_ID: "789be9a4588576db675cc2053ea3a89d"

	environment: production: {
		VIDEOS_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-videos/access-key"
		}
		VIDEOS_SECRET_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-videos/secret-key"
		}
		CONTENT_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/access-key-id"
		}
		CONTENT_SECRET_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/secret-access-key"
		}
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
		}
	}
}

tasks: {
	run: {
		command: "bun"
		args: ["run", "start"]
	}
}
