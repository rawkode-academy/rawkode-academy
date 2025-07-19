package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

learner: schema.#Persona & {
	id:          "learner"
	title:       "Learner"
	description: "A learner who consumes content on the Rawkode Academy platform."

	goals: [
		"Learn about specific cloud-native technologies.",
		"Stay up-to-date with industry trends.",
		"Find content that is relevant to their skill level and interests.",
		"Engage with the content and the community.",
	]

	painPoints: [
		"Difficulty finding content on a specific topic.",
		"Not knowing what content to watch next.",
		"Video player or website usability issues.",
		"Wanting to ask questions or discuss the content with others.",
	]

	context: """
		Viewers are the primary audience of Rawkode Academy. The platform must
		provide an excellent viewing experience, with easy content discovery,
		high-quality playback, and opportunities for community engagement.
		"""

	role:       "Learner"
	experience: "varied"
}
