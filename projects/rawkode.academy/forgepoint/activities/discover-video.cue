package activities

import (
	"github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/schema"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

discoverVideo: schema.#Activity & {
	id:          "discover-video"
	title:       "Discover a Video"
	description: "Spark Curiosity & Serendipitous Learning. By showcasing new and popular videos, we encourage learners to explore beyond their immediate needs and discover content they might not have found otherwise. It's about fostering a sense of exploration and allowing learners to stumble upon valuable videos that expand their knowledge and skills in unexpected ways."
	order:       110
	outcome:     "Users can discover videos through exploration and serendipitous learning"
	personas: [
		p.learner.id,
	]
}
