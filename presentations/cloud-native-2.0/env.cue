package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
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
	deploy: {
		command: "cdktf"
		args: ["deploy", "--auto-approve"]
	}
}
