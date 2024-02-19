package people

import "rawkode.academy/data/schema"

rawkode: schema.#Person & {
	handle: "rawkode"
	name:   "David Flanagan"

	socialAccounts: {
		bluesky: handle:  "rawkode.dev"
		discord: handle:  "rawkode"
		mastodon: handle: "@david@rawkode.dev"
		x: handle:        "rawkode"
	}

	links: {
		website: "https://rawkode.dev"
	}
}
