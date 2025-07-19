package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

manageMarketingPreferences: schema.#Activity & {
	id:          "manage-marketing-preferences"
	title:       "Manage Marketing Preferences"
	description: "Manage Marketing Preferences"
	order:       50
	outcome:     "Users can manage their marketing preferences"
	personas: [
		p.learner.id,
	]
}
