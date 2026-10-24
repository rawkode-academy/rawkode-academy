package zone

import "registry.terraform.io/dnsimple/dnsimple/resources/dnsimple_domain_delegation"

// Cloudflare assigns these to every zone in the account.
_nameServers: ["curt.ns.cloudflare.com", "miki.ns.cloudflare.com"]

// #DNSimpleRegistrar is for domains registered with DNSimple, delegated to
// Cloudflare's name servers.
#DNSimpleRegistrar: {
	#Zone
	name:      _
	_slug:     _
	registrar: "dnsimple"
	resources: "\(_slug)_delegation": dnsimple_domain_delegation.#Resource & {
		configuration: {domain: name, name_servers: _nameServers}
	}
}
