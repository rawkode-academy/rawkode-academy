package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

productOwner: schema.#Persona & {
	id:          "product-owner"
	title:       "Product Owner"
	description: "Responsible for product vision, backlog management, and stakeholder communication"
	
	goals: [
		"Define and communicate product vision",
		"Prioritize features based on user value",
		"Track product evolution over time",
		"Collaborate effectively with development team",
		"Report progress to stakeholders",
	]
	
	painPoints: [
		"Story maps in spreadsheets lose history",
		"Difficult to track why decisions were made",
		"No version control for product plans",
		"Hard to visualize dependencies",
		"Separate tools for planning and code",
	]
	
	context: """
		Product owners need a single source of truth for product planning that
		integrates with their development workflow. They want to see how the
		product has evolved and plan future iterations based on user journeys.
		"""
	
	role: "Product Management"
	experience: "intermediate"
}