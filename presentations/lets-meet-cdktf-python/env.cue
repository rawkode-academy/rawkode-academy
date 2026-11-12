package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "presentation-lets-meet-cdktf-python"

// Uses its own Cloudflare token, not the ones the root env.cue chooses.
_ownCloudflareToken: true

env: {
	ABC: "123"

	environment: production: {
		SCW_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Private/Scaleway/accessKey"
		}
		SCW_SECRET_KEY: schema.#OnePasswordRef & {
			ref: "op://Private/Scaleway/secretKey"
		}
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Private/Cloudflare/Root"
		}
	}
}

tasks: {
	deploy: schema.#Task & {
		command: "cdktf"
		args: ["deploy", "--auto-approve"]
	}
}
