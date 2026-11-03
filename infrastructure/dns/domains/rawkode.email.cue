package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.email": zone.#CloudflareRegistrar & zone.#CloudflareEmailRouting & {
	id: "fdd812febb34498f7f3973fc91d4f6fc"
	txt: "_dmarc": dmarc: value: "v=DMARC1; p=reject;"
}
