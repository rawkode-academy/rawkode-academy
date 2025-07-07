package actions

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/validate-product:activities"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

cliValidation: schema.#Action & {
	id:          "cli-validation"
	title:       "CLI Validation Commands"
	description: "Validate ForgePoint data using command-line tools"
	activityId:  activities.validateProduct.id
	order:       1
	
	stories: [
		{
			id:          "story-validate-schemas"
			title:       "Validate CUE schemas"
			description: "Check that all CUE files conform to ForgePoint schemas"
			
			asA:    personas.developer.title
			iWant:  "to validate my ForgePoint files"
			soThat: "I catch errors before committing"
			
			acceptanceCriteria: [
				"CLI validates all .cue files in forgepoint/",
				"Reports schema violations with file and line number",
				"Returns non-zero exit code on validation failure",
				"Can validate single files or entire directory",
			]
			
			priority: "must"
			size:     "M"
			
			attachments: [
				schema.#BDDScenario & {
					type:  "bdd-scenario"
					title: "Validate entire ForgePoint directory"
					given: [
						"I have a ForgePoint repository",
						"Some files have schema violations",
					]
					when: [
						"I run 'forgepoint validate'",
					]
					then: [
						"I see a list of validation errors",
						"Each error shows file:line:column",
						"Exit code is 1",
					]
				},
			]
		},
		{
			id:          "story-check-references"
			title:       "Check cross-references"
			description: "Verify that all ID references point to existing items"
			
			asA:    personas.productOwner.title
			iWant:  "to check that all references are valid"
			soThat: "I don't have broken links in my product definition"
			
			acceptanceCriteria: [
				"Validates persona references in activities",
				"Validates activity references in actions",
				"Validates story dependencies",
				"Reports orphaned items with no references",
			]
			
			priority: "must"
			size:     "L"
		},
		{
			id:          "story-lint-conventions"
			title:       "Lint for conventions"
			description: "Check that ForgePoint data follows best practices"
			
			asA:    personas.developer.title
			iWant:  "to check for convention violations"
			soThat: "our product definitions stay consistent"
			
			acceptanceCriteria: [
				"Checks ID naming conventions",
				"Validates story format (As a... I want... So that...)",
				"Ensures acceptance criteria are present",
				"Suggests improvements for readability",
			]
			
			priority: "should"
			size:     "M"
		},
	]
}