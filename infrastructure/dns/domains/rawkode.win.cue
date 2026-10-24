package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.win": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id: "b2546df6cf4d04e8cfa28a0428b78cf0"
}
