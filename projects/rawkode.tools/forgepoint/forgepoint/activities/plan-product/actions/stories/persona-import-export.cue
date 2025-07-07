package stories

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

// Example of a story defined in a separate file
personaImportExport: schema.#UserStory & {
	id:          "story-persona-import-export"
	title:       "Import and export personas"
	description: "Support importing personas from and exporting to other formats"
	
	asA:    personas.productOwner.title
	iWant:  "to import/export personas"
	soThat: "I can integrate with other tools"
	
	acceptanceCriteria: [
		"Can import personas from JSON",
		"Can export personas to YAML",
		"Validates imported data against schema",
		"Preserves all persona fields during conversion",
	]
	
	priority: "could"
	size:     "M"
	
	attachments: [
		schema.#BDDScenario & {
			type:  "bdd-scenario"
			title: "Import persona from JSON"
			given: [
				"I have a persona in JSON format",
				"The JSON follows the expected structure",
			]
			when: [
				"I run the import command",
				"I specify the target directory",
			]
			then: [
				"A new persona CUE file is created",
				"The data is validated against #Persona",
				"The file can be committed to Git",
			]
		},
	]
}