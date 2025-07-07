package actions

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/visualize-product:activities"
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

productboardParity: schema.#Action & {
	id:          "productboard-parity"
	title:       "ProductBoard Replacement Features"
	description: "Features to achieve parity with ProductBoard"
	activityId:  activities.visualizeProduct.id
	order:       2
	
	stories: [
		{
			id:          "story-insights-portal"
			title:       "Customer insights portal"
			description: "Collect and link customer feedback to stories"
			
			asA:    personas.productOwner.title
			iWant:  "to link customer feedback to stories"
			soThat: "I can justify prioritization decisions"
			
			acceptanceCriteria: [
				"Import feedback from multiple sources",
				"Link feedback to specific stories",
				"Show feedback count on story cards",
				"Tag feedback by customer segment",
				"Generate insight reports",
			]
			
			priority: "should"
			size:     "XL"
		},
		{
			id:          "story-roadmap-sharing"
			title:       "Public roadmap sharing"
			description: "Share roadmap views with customers and stakeholders"
			
			asA:    personas.stakeholder.title
			iWant:  "to share our roadmap publicly"
			soThat: "customers know what's coming"
			
			acceptanceCriteria: [
				"Generate public roadmap URL",
				"Hide internal details",
				"Show only high-level timeline",
				"Custom branding options",
				"Embed in other sites",
			]
			
			priority: "should"
			size:     "L"
		},
		{
			id:          "story-prioritization-scoring"
			title:       "Prioritization scoring"
			description: "Score and rank stories using various frameworks"
			
			asA:    personas.productOwner.title
			iWant:  "to score stories systematically"
			soThat: "prioritization is objective and transparent"
			
			acceptanceCriteria: [
				"Support RICE scoring",
				"Support value/effort matrix",
				"Custom scoring formulas",
				"Automatic ranking based on scores",
				"Historical score tracking",
			]
			
			priority: "could"
			size:     "L"
		},
		{
			id:          "story-feature-voting"
			title:       "Feature voting system"
			description: "Allow stakeholders to vote on features"
			
			asA:    personas.stakeholder.title
			iWant:  "to vote on feature priorities"
			soThat: "my input influences the roadmap"
			
			acceptanceCriteria: [
				"Authenticated voting",
				"Vote allocation limits",
				"Comments on votes",
				"Vote analytics",
				"Integration with prioritization",
			]
			
			priority: "could"
			size:     "M"
		},
	]
}