package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "cloudnativecompass.fm": zone.#CloudflareRegistrar & zone.#NoEmail & zone.#BotFightMode & {
	id:  "0d778b733d714b02df97c59de32c6fc4"
	ttl: 300
}
