package schema

// Persona represents a type of user with specific goals and needs
#Persona: #Metadata & {
	goals: [...string]
	painPoints: [...string]
	context: string
	
	// Optional demographic or role information
	role?: string
	experience?: "beginner" | "intermediate" | "expert"
}