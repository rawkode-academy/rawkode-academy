package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.cloud": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id: "74966f6182319530ff6e643516300350"
	txt: "@": spf: ttl: 300
}
