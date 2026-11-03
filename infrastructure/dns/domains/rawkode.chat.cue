package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.chat": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id: "e42b49b075a643a2fb4ebfba59abf4b2"
	txt: "@": spf: ttl: 300
}
