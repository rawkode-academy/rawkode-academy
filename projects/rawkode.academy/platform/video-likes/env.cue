package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	"github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"
)

schema.#Project

name: "rawkode-academy-platform-video-likes"

let _service = cubes.#PlatformService & {
	serviceName:       "video-likes"
	includeWriteModel: false
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-likes"
			databaseId:   "a21ba9e6-f246-4bf1-a71f-c9ef4a45733b"
		}]
	}
}

cube: _service.cube

env: {
	SERVICE_NAME:     "video-likes"
	LIBSQL_URL:       "http://localhost:2000"
	DENO_ALLOWED_ENV: "LIBSQL_BASE_URL,LIBSQL_URL,LIBSQL_TOKEN,NODE_ENV"
}

ci: pipelines: [
	{
		name: "default"
		when: {
			branch: ["main"]
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
