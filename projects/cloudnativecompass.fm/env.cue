package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "cloudnativecompass-fm"


tasks: {
	terraform: {
		type: "group"
		plan: {
			command: "terraform"
			args: ["plan", "-out=.terraform.plan.json"]
		}
		apply: {
			command: "terraform"
			args: ["apply", ".terraform.plan.json"]
			dependsOn: [plan]
		}
	}
}
