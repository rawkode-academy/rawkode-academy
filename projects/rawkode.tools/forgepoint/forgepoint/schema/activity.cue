package schema

// Activity represents a major user journey step
#Activity: #Metadata & {
	order:    int & >=1
	outcome:  string  // What the user achieves
	personas: [...#Reference]  // Which personas perform this activity
	
	// Optional metrics for success
	metrics?: [...{
		name:   string
		target: string
	}]
}