package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "projen-generator"

tasks: {
	install: {
		command: "deno"
		args: ["install"]
	}
	types: {
		command: "deno"
		args: ["run", "types"]
		dependsOn: ["install"]
	}
}
