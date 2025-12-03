package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	SERVICE_NAME: "analytics"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
		GRAFANA_OTLP_ENDPOINT: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/grafana/url"
		}
		GRAFANA_OTLP_USERNAME: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/grafana/username"
		}
		GRAFANA_OTLP_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/grafana/password"
		}
	}
}

ci: pipelines: [
	{
		name: "default"
		when: {
			branch: ["main"]
			defaultBranch: true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	dev: {
		command: "bunx"
		args: ["wrangler", "dev"]
	}

	sync: secrets: [
		{
			command: "sh"
			args: ["-c", "echo $GRAFANA_OTLP_ENDPOINT | bunx wrangler secret put GRAFANA_OTLP_ENDPOINT"]
		},
		{
			command: "sh"
			args: ["-c", "echo $GRAFANA_OTLP_USERNAME | bunx wrangler secret put GRAFANA_OTLP_USERNAME"]
		},
		{
			command: "sh"
			args: ["-c", "echo $GRAFANA_OTLP_TOKEN | bunx wrangler secret put GRAFANA_OTLP_TOKEN"]
		},
	]

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
	}

	typegen: {
		command: "bunx"
		args: ["wrangler", "types", "--env-interface", "CloudflareBindings"]
	}
}
