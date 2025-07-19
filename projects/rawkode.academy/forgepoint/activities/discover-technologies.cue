package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

discoverTechnologies: schema.#Activity & {
	id:          "discover-technologies"
	title:       "Discover Technologies"
	description: "Discover Technologies"
	order:       70
	outcome:     "Users can discover technologies"
	personas: [
		p.learner.id,
	]
}
