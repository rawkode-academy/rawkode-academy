package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

validateProduct: schema.#Activity & {
	id:          "validate-product"
	title:       "Validate Product Definition"
	description: "Use ForgePoint CLI to validate schemas and find issues"
	order:       4
	outcome:     "Confidence that product definitions are valid and consistent"
	
	personas: [
		personas.productOwner.id,
		p.developer.id,
	]
}