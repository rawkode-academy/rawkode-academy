package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

developer: schema.#Persona & {
	id:          "developer"
	title:       "Developer"
	description: "Engineers who build features and need to understand product context"
	
	goals: [
		"Understand the 'why' behind features",
		"See how stories connect to user journeys",
		"Track technical decisions alongside product decisions",
		"Contribute to product discussions",
	]
	
	painPoints: [
		"Product plans disconnected from code",
		"Unclear acceptance criteria",
		"No visibility into product roadmap",
		"Technical context lost in separate tools",
	]
	
	context: """
		Developers want product planning integrated with their workflow.
		They need to understand user needs and see how their work fits
		into the larger product vision.
		"""
	
	role: "Engineering"
	experience: "intermediate"
}