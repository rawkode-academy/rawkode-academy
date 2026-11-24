// Package domains holds one file per domain, named after it. Each file
// composes zone mixins for its entry in `zones`.
package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: [string]~(Name,_): zone.#Zone & {name: Name}
