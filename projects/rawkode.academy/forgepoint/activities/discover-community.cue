package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

discoverCommunity: schema.#Activity & {
	id:          "discover-community"
	title:       "Discover the Community"
	description: "Discover the Community"
	order:       140
	outcome:     "Users can discover and connect with the community"
	personas: [
		p.learner.id,
		p.contributor.id,
		p.moderator.id,
	]
}
