package actions

import (
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/rawkode.tools/forgepoint/forgepoint/activities/build-forgepoint:activities"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

cliImplementation: schema.#Action & {
	id:          "cli-implementation"
	title:       "Implement ForgePoint CLI"
	description: "Build the command-line interface for ForgePoint"
	activityId:  activities.buildForgepoint.id
	order:       1
	
	stories: [
		{
			id:          "story-cli-setup"
			title:       "Set up CLI project structure"
			description: "Initialize Go project with Charm dependencies"
			
			asA:    personas.developer.title
			iWant:  "to set up the CLI project"
			soThat: "I can start implementing ForgePoint commands"
			
			acceptanceCriteria: [
				"Go module initialized with correct path",
				"Charm dependencies added (fang, bubbletea, lipgloss)",
				"Basic command structure with fang",
				"README with development instructions",
				"Makefile for common tasks",
			]
			
			priority: "must"
			size:     "S"
		},
		{
			id:          "story-cue-loader"
			title:       "Implement CUE file loader"
			description: "Load and parse ForgePoint CUE files"
			
			asA:    personas.developer.title
			iWant:  "to load CUE files from forgepoint/"
			soThat: "I can validate and analyze them"
			
			acceptanceCriteria: [
				"Recursively find all .cue files",
				"Parse CUE with proper error handling",
				"Build unified value tree",
				"Handle imports correctly",
				"Cache parsed results",
			]
			
			priority: "must"
			size:     "M"
			
			dependencies: [
				{
					id:       "story-cli-setup"
					type:     "requires"
					duration: "1 day"
				},
			]
		},
		{
			id:          "story-validate-tui"
			title:       "Build interactive validation TUI"
			description: "Create Bubbletea interface for validation"
			
			asA:    personas.developer.title
			iWant:  "an interactive validation interface"
			soThat: "I can see and fix errors efficiently"
			
			acceptanceCriteria: [
				"List view of files with validation status",
				"Error details panel",
				"Keyboard navigation (vim-style)",
				"Syntax highlighted CUE snippets",
				"Jump to error in editor",
				"Progress indicator for large repos",
			]
			
			priority: "must"
			size:     "L"
			
			dependencies: [
				{
					id:       "story-cue-loader"
					type:     "requires"
					duration: "2 days"
				},
			]
			
			attachments: [
				schema.#BDDScenario & {
					type:  "bdd-scenario"
					title: "Navigate validation errors"
					given: [
						"I run 'forgepoint validate --interactive'",
						"There are validation errors",
					]
					when: [
						"I press 'j' to move down",
						"I press 'enter' on an error",
					]
					then: [
						"The error details are shown",
						"The CUE snippet is syntax highlighted",
						"I see suggestions for fixing",
					]
				},
			]
		},
		{
			id:          "story-cli-validate-command"
			title:       "Implement validate command"
			description: "Non-interactive validation with styled output"
			
			asA:    personas.developer.title
			iWant:  "to validate files from the command line"
			soThat: "I can use it in CI/CD pipelines"
			
			acceptanceCriteria: [
				"Validates all files by default",
				"Can specify individual files",
				"Styled output with lipgloss",
				"JSON output format option",
				"Exit codes for success/failure",
				"Summary statistics",
			]
			
			priority: "must"
			size:     "M"
			
			dependencies: [
				{
					id:       "story-cue-loader"
					type:     "requires"
					duration: "2 days"
				},
			]
		},
		{
			id:          "story-reference-checker"
			title:       "Implement reference checking"
			description: "Validate cross-references between ForgePoint items"
			
			asA:    personas.developer.title
			iWant:  "to check all ID references"
			soThat: "I know nothing is broken"
			
			acceptanceCriteria: [
				"Build graph of all IDs and references",
				"Check persona refs in activities",
				"Check activity refs in actions", 
				"Check story dependencies",
				"Report orphaned items",
				"Visual graph option",
			]
			
			priority: "must"
			size:     "L"
			
			dependencies: [
				{
					id:       "story-cue-loader"
					type:     "requires"
					duration: "2 days"
				},
			]
		},
		{
			id:          "story-browse-tui"
			title:       "Story map browser TUI"
			description: "Interactive browser for story map"
			
			asA:    personas.developer.title
			iWant:  "to browse the story map interactively"
			soThat: "I can explore product structure easily"
			
			acceptanceCriteria: [
				"Tree view of activities/actions/stories",
				"Expand/collapse nodes",
				"Search functionality",
				"Filter by persona/priority",
				"View story details",
				"Export filtered views",
			]
			
			priority: "should"
			size:     "XL"
			
			dependencies: [
				{
					id:       "story-validate-tui"
					type:     "requires"
					duration: "3 days"
				},
			]
		},
	]
}