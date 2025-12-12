package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

env: environment: production: {
	TF_VAR_cloudflare_account_id: env.environment.production.CLOUDFLARE_ACCOUNT_ID
}

tasks: {
	terraform: {
		plan: {
			command: "terraform"
			args: ["plan", "-out=.terraform.plan.json"]
		}
		apply: {
			command: "terraform"
			args: ["apply", ".terraform.plan.json"]
			dependsOn: ["terraform.plan"]
		}
	}
}
