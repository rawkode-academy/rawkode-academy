package schema

// Action represents what users do within an activity
#Action: #Metadata & {
	activityId: #Reference
	order:      int & >=1
	
	// Actions contain stories directly
	stories: [...#UserStory]
	
	// Dependencies on other actions
	dependencies?: [...#Dependency]
}