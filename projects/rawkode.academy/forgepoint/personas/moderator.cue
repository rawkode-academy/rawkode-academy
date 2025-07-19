package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

moderator: schema.#Persona & {
	id:          "moderator"
	title:       "Moderator"
	description: "A community member who helps maintain a positive and productive environment."

	goals: [
		"Foster a welcoming and inclusive community.",
		"Help users find answers to their questions.",
		"Enforce community guidelines.",
		"Identify and escalate issues to the platform owner.",
	]

	painPoints: [
		"Dealing with spam or inappropriate content.",
		"Lack of tools to effectively manage the community.",
		"Difficulty tracking conversations and user issues.",
		"Balancing moderation with being an active community member.",
	]

	context: """
		Moderators are essential for a healthy community. They need tools
		to efficiently manage discussions, enforce rules, and support users,
		ensuring the community remains a valuable resource for everyone.
		"""

	role:       "Community Moderator"
	experience: "intermediate"
}
