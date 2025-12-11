package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

tasks: {
	projen: {
		command: "bun"
		args: ["run", ".projenrc.ts"]
		labels: ["projen"]
	}
}
