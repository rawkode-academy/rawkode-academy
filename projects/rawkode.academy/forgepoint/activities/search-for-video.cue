package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

searchForVideo: schema.#Activity & {
	id:          "search-for-video"
	title:       "Search for a Video"
	description: "Search for a Video. #162 has some ideas"
	order:       100
	outcome:     "Users can search for videos"
	personas: [
		p.learner.id,
	]
}
