package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

manageProfile: schema.#Activity & {
	id:          "manage-profile"
	title:       "Manage Profile"
	description: "Manage Profile"
	order:       60
	outcome:     "Users can manage their profile"
	personas: [
		p.learner.id,
		p.guest.id,
		p.host.id,
		p.moderator.id,
		p.contributor.id,
	]
}
