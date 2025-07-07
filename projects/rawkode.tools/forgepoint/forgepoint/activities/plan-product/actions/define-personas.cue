package actions

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/plan-product:activities"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/plan-product/actions/stories"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

definePersonas: schema.#Action & {
	id:          "define-personas"
	title:       "Manage Personas"
	description: "Create and maintain user personas in ForgePoint"
	activityId:  activities.planProduct.id
	order:       1
	
	stories: [
		{
			id:       "story-persona-crud"
			title:    "Manage personas in ForgeFlow"
			description: "Create, read, update, and delete personas as CUE files"
			
			asA:    personas.productOwner.title
			iWant:  "to manage personas as versioned files"
			soThat: "user types are documented and tracked over time"
			
			acceptanceCriteria: [
				"Personas are stored as CUE files in forgepoint/personas/",
				"Personas follow the #Persona schema",
				"Can reference personas by ID in stories",
				"Persona changes tracked in Git history",
			]
			
			priority: "must"
			size:     "S"
			
			attachments: [
				schema.#BDDScenario & {
					type:  "bdd-scenario"
					title: "Create new persona"
					given: [
						"I am in a ForgePoint-enabled repository",
						"I have identified a new user type",
					]
					when: [
						"I create a new file in forgepoint/personas/",
						"I define the persona using #Persona schema",
						"I commit the file",
					]
					then: [
						"The persona can be referenced by ID",
						"CUE validation passes",
						"Git tracks the persona creation",
					]
				},
			]
		},
		{
			id:       "story-persona-versioning"
			title:    "Track persona evolution"
			description: "View how personas change over time using Git history"
			
			asA:    personas.productOwner.title
			iWant:  "to see how personas evolved"
			soThat: "I understand how our user understanding has changed"
			
			acceptanceCriteria: [
				"Can view persona history with git log",
				"Can see what changed with git diff",
				"Can understand why with commit messages",
				"Can revert if needed",
			]
			
			priority: "should"
			size:     "XS"
		},
		// Example of importing a story from another file
		stories.personaImportExport,
	]
}