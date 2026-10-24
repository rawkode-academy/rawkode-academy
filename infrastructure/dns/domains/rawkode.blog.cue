package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.blog": zone.#CloudflareRegistrar & {
	id: "b93456e85b67ca78983580b1d1a27061"
}
