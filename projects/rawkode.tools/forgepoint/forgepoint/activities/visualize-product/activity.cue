package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

visualizeProduct: schema.#Activity & {
	id:          "visualize-product"
	title:       "Visualize Product Roadmap"
	description: "View product plans through interactive visualizations"
	order:       5
	outcome:     "Clear visual understanding of product roadmap and dependencies"
	
	personas: [
		p.productOwner.id,
		p.developer.id,
		p.stakeholder.id,
	]
}