package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

planProduct: schema.#Activity & {
	id:          "plan-product"
	title:       "Plan Product Evolution"
	description: "Use ForgePoint to define and track product capabilities over time"
	order:       1
	outcome:     "Product capabilities documented and versioned in Git"
	
	personas: [
		p.productOwner.id,
		personas.developer.id,
		personas.stakeholder.id,
	]
}