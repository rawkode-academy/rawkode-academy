package zone

import "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_zone_dnssec"

#Zone: dnssec?: "active" | "disabled"

// #CloudflareRegistrar is for domains registered with Cloudflare, which
// publishes the DS records itself once DNSSEC is on.
#CloudflareRegistrar: {
	#Zone
	id:        _
	_slug:     _
	registrar: "cloudflare"
	dnssec:    *"active" | "disabled"
	resources: "\(_slug)_dnssec": cloudflare_zone_dnssec.#Resource & {
		configuration: {zone_id: id, status: dnssec}
	}
}
