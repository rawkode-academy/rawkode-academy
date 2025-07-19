package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

expandKnowledge: schema.#Activity & {
	id:          "expand-knowledge"
	title:       "Expand their Knowledge"
	description: "Expand their Knowledge"
	order:       20
	outcome:     "Viewers can expand their knowledge"
	personas: [
		p.learner.id,
	]
}
