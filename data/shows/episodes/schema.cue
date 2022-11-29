package episodes

#Episode: {
	title:        string
	show:         string
	guests:       [...string] | *[]
	technologies: [...string] | *[]
}

#NumberedEpisode: {
	"episode-number":  int
	#Episode
}

"klustered": [ for idx, episode in _klusteredEpisodes { "episode-number": idx, episode } ]
"rawkode-live": [ for idx, episode in _rawkodeLiveEpisodes { "episode-number": idx, episode } ]
