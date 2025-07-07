package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

stakeholder: schema.#Persona & {
	id:          "stakeholder"
	title:       "Stakeholder"
	description: "Business leaders and customers who need visibility into product direction"
	
	goals: [
		"Understand product roadmap and priorities",
		"See progress on key initiatives",
		"Provide input on strategic direction",
		"Access product plans without technical barriers",
	]
	
	painPoints: [
		"Plans locked in proprietary tools",
		"No historical view of decisions",
		"Difficult to see dependencies",
		"Can't easily review proposed changes",
	]
	
	context: """
		Stakeholders need read-only access to product plans and the ability
		to review proposed changes through familiar interfaces like pull requests.
		"""
	
	role: "Business Leadership"
	experience: "beginner"
}