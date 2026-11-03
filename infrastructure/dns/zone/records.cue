package zone

import (
	"list"
	"strings"

	"registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_dns_record"
)

// Records are keyed by DNS identity, so unification enforces DNS rules: a
// name has one CNAME, and mixins that claim the same TXT label must agree.
#Zone: {
	name:  _
	id:    _
	_slug: _

	// TTL for records that don't set their own; 1 is Cloudflare's "auto".
	ttl: *1 | int
	let zoneTtl = ttl

	// name → address → options
	a: [string]: [=~"^[0-9.]+$"]: {ttl: *zoneTtl | int}
	// name → target
	cname: [string]: {
		target!: string
		proxied: *false | bool
		ttl:     *zoneTtl | int
	}
	// name → host → options
	mx: [string]: [string]: {
		priority!: int
		ttl:       *zoneTtl | int
	}
	// name → host → options
	ns: [string]: [string]: {ttl: *zoneTtl | int}
	// name → label → value; the label only names the resource.
	txt: [string]: [=~"^[a-z0-9-]+$"]: {
		value!: string
		ttl:    *zoneTtl | int
	}
	// name → target
	srv: [string]: {
		priority: *0 | int
		weight!:  int
		port!:    int
		target!:  string
		ttl:      *zoneTtl | int
	}

	resources: {
		for record, addresses in a for address, options in addresses {
			"\(_slug)_a_\((_#Slug & {in: record}).out)_\((_#Slug & {in: address}).out)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {zone_id: id, type: "A", content: address, ttl: options.ttl}
			}
		}

		for record, options in cname {
			"\(_slug)_cname_\((_#Slug & {in: record}).out)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {zone_id: id, type: "CNAME", content: options.target, proxied: options.proxied, ttl: options.ttl}
			}
		}

		for record, hosts in mx for host, options in hosts {
			"\(_slug)_mx_\((_#Slug & {in: record}).out)_\((_#Slug & {in: host}).out)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {zone_id: id, type: "MX", content: host, priority: options.priority, ttl: options.ttl}
			}
		}

		for record, hosts in ns for host, options in hosts {
			"\(_slug)_ns_\((_#Slug & {in: record}).out)_\((_#Slug & {in: host}).out)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {zone_id: id, type: "NS", content: host, ttl: options.ttl}
			}
		}

		for record, values in txt for label, options in values {
			"\(_slug)_txt_\((_#Slug & {in: record}).out)_\(label)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {zone_id: id, type: "TXT", content: (_#TxtContent & {in: options.value}).out, ttl: options.ttl}
			}
		}

		for record, options in srv {
			"\(_slug)_srv_\((_#Slug & {in: record}).out)": _#DnsRecord & {
				#zone: name
				#name: record
				configuration: {
					zone_id: id
					type:    "SRV"
					// Cloudflare stores the priority both at the top level and in data.
					priority: options.priority
					data: {priority: options.priority, weight: options.weight, port: options.port, target: options.target}
					ttl: options.ttl
				}
			}
		}
	}
}

_#DnsRecord: {
	cloudflare_dns_record.#Resource
	#zone: string
	#name: string
	configuration: {
		// The API returns fully qualified names; anything else plans a diff.
		name:    strings.TrimPrefix("\(#name).\(#zone)", "@.")
		comment: "Managed by cuenv"
	}
}

// _#TxtContent quotes a TXT value, splitting it into the 255-character
// strings DNS allows. Values are ASCII, so characters are bytes.
_#TxtContent: {
	in: string
	let size = len(strings.Runes(in))
	out: strings.Join([for start in list.Range(0, size, 255) {
		"\"\(strings.SliceRunes(in, start, list.Min([start + 255, size])))\""
	}], " ")
}
