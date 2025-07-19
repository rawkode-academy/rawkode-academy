package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

host: schema.#Persona & {
	id:          "host"
	title:       "Host"
	description: "The primary content creator, platform owner, and lead educator for Rawkode Academy."

	goals: [
		"Produce high-quality, engaging technical content.",
		"Grow a community of learners and experts.",
		"Build a sustainable platform for education.",
		"Collaborate with industry guests and experts.",
	]

	painPoints: [
		"Managing content production workflow is complex.",
		"Difficult to track all the moving parts of a distributed platform.",
		"Ensuring a consistent and high-quality experience for viewers.",
		"Onboarding and coordinating with guests can be time-consuming.",
	]

	context: """
		As the central figure, the Host needs to manage the entire lifecycle of content,
		from ideation and recording with guests to publishing and community interaction.
		The system should streamline these processes to maximize time spent on creating value.
		"""

	role:       "Host"
	experience: "expert"
}
