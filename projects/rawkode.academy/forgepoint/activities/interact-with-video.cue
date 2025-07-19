package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

interactWithVideo: schema.#Activity & {
	id:          "interact-with-video"
	title:       "Interact with a Video"
	description: "In-order for people to derive value from the Rawkode Academy, they need to be able to interact / consume content."
	order:       90
	outcome:     "Users can interact with and consume video content"
	personas: [
		p.learner.id,
	]
}
