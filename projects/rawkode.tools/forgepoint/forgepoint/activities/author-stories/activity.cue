package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

authorStories: schema.#Activity & {
	id:          "author-stories"
	title:       "Author Stories"
	description: "Write user stories and acceptance criteria using ForgePoint"
	order:       2
	outcome:     "Well-defined stories with clear acceptance criteria"
	
	personas: [
		p.productOwner.id,
		p.developer.id,
	]
}