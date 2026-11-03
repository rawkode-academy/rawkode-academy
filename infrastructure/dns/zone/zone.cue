// Package zone describes a Cloudflare zone and expands it into cuenv
// infrastructure resources. Mixins (#Gmail, #Fastmail, …) each live in their
// own file and add their parameters to #Zone there.
package zone

import (
	"strings"

	"github.com/cuenv/cuenv/schema"
)

// #Zone is a domain whose DNS Cloudflare serves. The zone itself is not
// managed: cuenv resources cannot reference each other's attributes yet, so
// its ID is a literal.
#Zone: {
	name!: =~"^[a-z0-9-]+(\\.[a-z0-9-]+)+$"
	id!:   =~"^[0-9a-f]{32}$"

	// Set by exactly one registrar mixin: none leaves it missing, two conflict.
	registrar!: "cloudflare" | "dnsimple"

	// Prefix of every resource name: "rawkode.academy" → "rawkode-academy".
	_slug: (_#Slug & {in: name}).out

	resources: [schema.#InfrastructureName]: schema.#ManagedResource
}

// _#Slug turns a DNS name into a resource name fragment:
// "@" → "apex", "*.teleport" → "wildcard-teleport",
// "_acme-challenge.billing" → "acme-challenge-billing".
_#Slug: {
	in: string
	out: strings.Join([for label in strings.Split(strings.TrimSuffix(strings.Replace(strings.Replace(in, "@", "apex", 1), "*", "wildcard", 1), "."), ".") {strings.TrimLeft(label, "_")}], "-")
}
