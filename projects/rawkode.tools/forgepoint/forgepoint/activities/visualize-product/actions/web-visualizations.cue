package actions

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/visualize-product:activities"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

webVisualizations: schema.#Action & {
	id:          "web-visualizations"
	title:       "Web UI Visualizations"
	description: "Interactive visualizations for product roadmap and planning"
	activityId:  activities.visualizeProduct.id
	order:       1
	
	stories: [
		{
			id:          "story-story-map-view"
			title:       "Interactive story map"
			description: "Visual story map showing activities, actions, and stories"
			
			asA:    personas.productOwner.title
			iWant:  "to see an interactive story map"
			soThat: "I can understand the product structure at a glance"
			
			acceptanceCriteria: [
				"Displays activities as columns",
				"Shows actions under each activity",
				"Stories appear under their actions",
				"Can expand/collapse sections",
				"Shows persona icons on stories",
				"Indicates priority with visual cues",
			]
			
			priority: "must"
			size:     "L"
			
			attachments: [
				schema.#BDDScenario & {
					type:  "bdd-scenario"
					title: "View story map"
					given: [
						"I have a ForgePoint repository",
						"I'm on the story map page",
					]
					when: [
						"The page loads",
					]
					then: [
						"I see activities as horizontal lanes",
						"Actions are grouped under activities",
						"Stories are cards under actions",
						"Priority is shown with colors",
					]
				},
			]
		},
		{
			id:          "story-gantt-chart"
			title:       "Gantt chart for dependencies"
			description: "Timeline view showing story dependencies and durations"
			
			asA:    personas.productOwner.title
			iWant:  "to see a Gantt chart of stories"
			soThat: "I can plan releases based on dependencies"
			
			acceptanceCriteria: [
				"Shows stories on timeline",
				"Displays dependency arrows between stories",
				"Uses story size to estimate duration",
				"Can filter by persona or priority",
				"Highlights critical path",
				"Allows drag-and-drop scheduling",
			]
			
			priority: "must"
			size:     "XL"
			
			dependencies: [
				{
					id:       "story-check-references"
					type:     "requires"
					duration: "1 week"
				},
			]
		},
		{
			id:          "story-kanban-board"
			title:       "Kanban board for workflow"
			description: "Board view for tracking story progress"
			
			asA:    personas.developer.title
			iWant:  "to see stories in a Kanban board"
			soThat: "I can track work in progress"
			
			acceptanceCriteria: [
				"Connects to external database for status",
				"Shows stories as cards",
				"Columns for workflow states",
				"Can filter by activity/action",
				"Shows WIP limits",
				"Links to Git commits",
			]
			
			priority: "should"
			size:     "L"
		},
		{
			id:          "story-dependency-graph"
			title:       "Dependency visualization"
			description: "Graph showing relationships between stories"
			
			asA:    personas.stakeholder.title
			iWant:  "to see how stories connect"
			soThat: "I understand the complexity and risks"
			
			acceptanceCriteria: [
				"Interactive node graph",
				"Stories as nodes",
				"Dependencies as edges",
				"Color coding by status",
				"Zoom and pan controls",
				"Click to see story details",
			]
			
			priority: "could"
			size:     "M"
		},
	]
}