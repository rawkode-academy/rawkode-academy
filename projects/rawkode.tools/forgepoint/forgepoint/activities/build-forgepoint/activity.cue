package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

buildForgepoint: schema.#Activity & {
	id:          "build-forgepoint"
	title:       "Build ForgePoint Tools"
	description: "Develop the ForgePoint CLI and Web UI tools"
	order:       6
	outcome:     "Working ForgePoint tools for validation and visualization"
	
	personas: [
		personas.developer.id,
	]
}