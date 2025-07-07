package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

reviewChanges: schema.#Activity & {
	id:          "review-changes"
	title:       "Review Changes"
	description: "Review and approve product evolution through pull requests"
	order:       3
	outcome:     "Product changes reviewed and merged with team consensus"
	
	personas: [
		p.productOwner.id,
		p.developer.id,
		p.stakeholder.id,
	]
}