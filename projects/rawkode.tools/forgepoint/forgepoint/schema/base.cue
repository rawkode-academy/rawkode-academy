package schema

// Base types and common fields used across ForgePoint

#ID: string & =~"^[a-z0-9-]+$"

#Priority: "must" | "should" | "could" | "wont"

#Status: "proposed" | "accepted" | "completed" | "deprecated"

// Common metadata that Git tracks for us
// We don't need created/updated/author fields
#Metadata: {
	id:          #ID
	title:       string & =~"^.{1,200}$"
	description: string & =~"^.{0,2000}$"
}

// Dependencies between items for roadmap planning
#Dependency: {
	id:       #ID
	type:     "blocks" | "requires" | "relates-to"
	duration: string | *null  // e.g., "2 weeks", "1 month"
}

// Reference to another item by ID
#Reference: #ID

// Attachments that can be added to stories
#Attachment: {
	type: "bdd-scenario" | "mockup" | "diagram" | "document"
	...
}

// Estimated size or effort
#Size: "XS" | "S" | "M" | "L" | "XL"