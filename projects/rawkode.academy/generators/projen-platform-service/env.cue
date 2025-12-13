package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "projen-generator"

tasks: {
	install: {
		command: "npm"
		args: ["install"]
	}
	types: {
		command: "npm"
		args: ["run", "types"]
		dependsOn: ["install"]
	}
}
