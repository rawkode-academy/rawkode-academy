package shows

import "rawkode.academy/schema"
import "rawkode.academy/live-streams/rawkode-live:livestreams"

"rawkode-live": schema.#Show & {
  title: "Rawkode Live"
  description: "Fun"
  liveStreams: livestreams
}
