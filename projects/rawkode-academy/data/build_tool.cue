package export

import (
	"encoding/json"
	"tool/cli"
	"rawkode.academy/data/shows"
)

command: build: cli.Print & {
	text: json.Marshal({
		"shows": {
			for id, show in shows {
				(id): show & {
					"id": id
				}
			}
		}
	})
}
