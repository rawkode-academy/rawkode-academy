package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

manageLivestreams: schema.#Activity & {
	id:          "manage-livestreams"
	title:       "Manage Livestreams"
	description: "Manage Livestreams"
	order:       10
	outcome:     "Livestreams are managed effectively"
	personas: [
		p.host.id,
	]
}
