package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

deepenExpertise: schema.#Activity & {
	id:          "deepen-expertise"
	title:       "Deepen Expertise"
	description: "Advance from foundational knowledge to mastery by engaging with specialized content, expert-led workshops, and advanced practice materials. This activity focuses on users who have moved beyond beginner status and seek to develop professional-level skills, gain nuanced understanding, and build recognized competency in their chosen subjects."
	order:       130
	outcome:     "Users can advance from foundational knowledge to mastery through specialized content"
	personas: [
		p.learner.id,
	]
}
