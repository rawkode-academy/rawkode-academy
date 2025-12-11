package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

name: "projen-generator"

tasks: {
	install: {
		command: "bun"
		args: ["install"]
	}
	types: {
		command: "bun"
		args: ["run", "types"]
		dependsOn: ["install"]
	}
}
