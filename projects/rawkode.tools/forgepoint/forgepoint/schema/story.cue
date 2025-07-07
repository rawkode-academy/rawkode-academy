package schema

// User Story represents a unit of value delivery
#UserStory: #Metadata & {
	// Story format
	asA:     string  // persona or role
	iWant:   string  // the goal
	soThat:  string  // the benefit
	
	// Planning information
	acceptanceCriteria: [...string]
	priority:           #Priority
	size:              #Size | *null
	
	// Dependencies and relationships
	dependencies?: [...#Dependency]
	
	// Optional attachments
	attachments?: [...#StoryAttachment]
}

// Feature enhances an existing story
#Feature: #Metadata & {
	storyId:      #Reference
	enhancement:  string  // What this adds to the story
	priority:     #Priority
	size:        #Size | *null
	dependencies?: [...#Dependency]
}

// Attachments specific to stories
#StoryAttachment: #Attachment & {
	{type: "bdd-scenario"} | 
	{type: "mockup", url: string} |
	{type: "diagram", url: string} |
	{type: "document", url: string}
}

// BDD Scenario attachment
#BDDScenario: #StoryAttachment & {
	type:  "bdd-scenario"
	title: string
	given: [...string]
	when:  [...string]
	then:  [...string]
}