package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

discoverPodcasts: schema.#Activity & {
	id:          "discover-podcasts"
	title:       "Discover Podcasts"
	description: "Podcast episodes with feeds"
	order:       120
	outcome:     "Users can discover podcast episodes through feeds"
	personas: [
		p.learner.id,
	]
}
