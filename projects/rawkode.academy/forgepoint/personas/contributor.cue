package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

contributor: schema.#Persona & {
	id:          "contributor"
	title:       "Contributor"
	description: "A community member who contributes content, code, or other resources."

	goals: [
		"Share their expertise with the community.",
		"Contribute to the growth and improvement of the platform.",
		"Gain recognition for their contributions.",
		"Collaborate with other community members.",
	]

	painPoints: [
		"Unclear contribution guidelines.",
		"Difficulty finding projects or areas to contribute to.",
		"Lack of feedback on their contributions.",
		"Technical barriers to contributing.",
	]

	context: """
		Contributors are a vital part of the Rawkode Academy ecosystem.
		The platform should make it easy for them to contribute, provide
		clear guidelines, and recognize their efforts to encourage
		continued participation.
		"""

	role:       "Community Contributor"
	experience: "varied"
}
