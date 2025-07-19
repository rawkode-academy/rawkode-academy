package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

discoverShows: schema.#Activity & {
	id:          "discover-shows"
	title:       "Discover Shows"
	description: "Discover Shows"
	order:       80
	outcome:     "Users can discover shows"
	personas: [
		p.learner.id,
	]
}
