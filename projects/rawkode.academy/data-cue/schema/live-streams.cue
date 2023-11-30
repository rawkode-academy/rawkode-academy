package schema

import "list"

#Show: {
	title!:       string
	description!: string
	liveStreams!: [string]: #LiveStream
	_uniqueEpisodeNumbers: [...number]
	_uniqueEpisodeNumbers: list.UniqueItems
	_uniqueEpisodeNumbers: [
		for _, liveStream in liveStreams {
			liveStream.episodeNumber
    }
  ]
}

#LiveStream: {
	title!:         string
	episodeNumber!: number
  series?:        #Series
}

#Series: {
  title!: string
}
