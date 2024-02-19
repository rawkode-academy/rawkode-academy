package schema

#Person: {
	handle!:         string
	name!:           string
	socialAccounts?: #SocialAccounts
	links?: [string]: string
}

#Links: {
	name!: string
	url!:  string
}

#SocialAccounts: {
	bluesky?:  #BlueSkyAccount
	discord?:  #DiscordAccount
	mastodon?: #MastodonAccount
	x?:        #XAccount
}

#BlueSkyAccount: {
	handle!: string
	url:     string | *"https://bsky.app/profile/\(handle)"
}

#DiscordAccount: {
	handle!: string
	url:     string | *"https://discord.com/users/\(handle)"
}

#MastodonAccount: {
	handle!: string
	// Mastodon URLs need to be resolved via webfinger
}

#XAccount: {
	handle!: string
	url:     string | *"https://x.com/\(handle)"
}
