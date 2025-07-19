package personas

import "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"

guest: schema.#Persona & {
	id:          "guest"
	title:       "Guest"
	description: "An industry expert or guest appearing on Rawkode Academy content."

	goals: [
		"Share their knowledge with the Rawkode Academy audience.",
		"Have a smooth and professional recording experience.",
		"Promote their own work or projects to the community.",
		"Collaborate effectively with Rawkode before, during, and after recording.",
	]

	painPoints: [
		"Unclear expectations or preparation guidelines.",
		"Technical difficulties during recording.",
		"Scheduling and time zone coordination.",
		"Lack of visibility into when their content will be published.",
	]

	context: """
		Guests are crucial for bringing diverse perspectives to the platform.
		The system must provide a seamless experience for them, from initial
		invitation and scheduling to technical setup and post-production communication.
		"""

	role:       "Content Contributor"
	experience: "varied"
}
