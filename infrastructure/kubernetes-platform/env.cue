package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	TERRAFORM_BINARY_NAME: "tofu"
}

ci: pipelines: [
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["plan"]
	},
]

tasks: {
	plan: {
		command: "tofu"
		args: ["plan"]
	}
	apply: {
		command: "tofu"
		args: ["apply", "-auto-approve"]
	}
}
