package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

engageWithCommunity: schema.#Activity & {
	id:          "engage-with-community"
	title:       "Engage with the Community"
	description: "Engage with the Community"
	order:       40
	outcome:     "Viewers can engage with the community"
	personas: [
		p.learner.id,
		p.moderator.id,
		p.contributor.id,
		p.host.id,
		p.guest.id,
	]
}
