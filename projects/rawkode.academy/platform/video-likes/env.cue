package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

env: {
	SERVICE_NAME:     "video-likes"
	LIBSQL_URL:       "http://localhost:2000"
	DENO_ALLOWED_ENV: "LIBSQL_BASE_URL,LIBSQL_URL,LIBSQL_TOKEN,NODE_ENV"
}

ci: pipelines: [
	{
		name: "default"
		when: {
			branch:        ["main"]
			defaultBranch: true
		}
		tasks: ["install", "deploy"]
	},
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["install"]
	},
]

tasks: {
	projen: {
		command: "bun"
		args: ["run", ".projenrc.ts"]
		labels: ["projen"]
	}
	install: {
		command: "bun"
		args: ["install"]
	}
	deploy: {
		command: "npx"
		args: ["wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
		dependsOn: ["install"]
	}
}
