package cuenv

env: {
	CLOUDFLARE_API_TOKEN:          "op://sa.rawkode.academy/cloudflare/password"
	CLOUDFLARE_CACHE_BUSTER_TOKEN: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/cache-buster"
	GRAFANA_SOURCE_MAPS:           "op://Employee/Grafana/api-tokens/source-maps"
	GRAPHQL_ENDPOINT:              "https://api.rawkode.academy/graphql"
	INFLUXDB_TOKEN:                "op://Employee/InfluxDB Cloud/rawkode.academy/all-access"
	RESEND_API_KEY:                "op://Employee/Resend/api-keys/website"
	ZULIP_API_KEY:                 "op://sa-core-infrastructure.bootstrap/Zulip Self-Hosted/bots/rocko"
}

hooks: onEnter: [{
	command: "devenv"
	args: ["print-dev-env"]
	source: true
}]

workspaces: bun: {}

tasks: {
	bun: {
		install: {
			command: "bun"
			args: ["install"]

			workspaces: ["bun"]

			inputs: [
				"bun.lock",
				"package.json"
			]
		}

		dev: {
			command: "bunx"
			args: ["wrangler", "dev"]

			workspaces: ["bun"]

			inputs: [
				"astro.config.mts",
				"bun.lock",
				"content/",
				"package.json",
				"public/",
				"src/**"
			]
		}

		build: {
			command: "bun"
			args: ["build"]

			workspaces: ["bun"]

			inputs: [
				"astro.config.mts",
				"bun.lock",
				"content/",
				"package.json",
				"public/",
				"src/**"
			]
		}
	}
}
