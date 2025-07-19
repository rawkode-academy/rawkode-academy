package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

engageWithContent: schema.#Activity & {
	id:          "engage-with-content"
	title:       "Engagement with the Content"
	description: "Engagement with the Content"
	order:       30
	outcome:     "Viewers can engage with the content"
	personas: [
		p.learner.id,
	]
}
