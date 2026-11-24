package zone

import "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_ruleset"

// #WwwToApexRedirect installs a zone-level Cloudflare Dynamic Redirect Ruleset
// that 301-redirects `www.<name>` to `https://<name>` at the edge (preserving
// path and query string) before requests reach Workers or CDN caching.
#WwwToApexRedirect: {
	#Zone
	name:  _
	id:    _
	_slug: _
	let _domain = name
	resources: "\(_slug)_www-to-apex-redirect": cloudflare_ruleset.#Resource & {
		configuration: {
			zone_id:     id
			name:        "Redirect www to apex"
			description: "301 redirect www.\(_domain) to https://\(_domain)"
			kind:        "zone"
			phase:       "http_request_dynamic_redirect"
			rules: [{
				action:      "redirect"
				description: "Redirect www.\(_domain) to https://\(_domain)"
				enabled:     true
				expression:  "(http.host eq \"www.\(_domain)\")"
				action_parameters: {
					from_value: {
						preserve_query_string: true
						status_code:           301
						target_url: {
							expression: "concat(\"https://\(_domain)\", http.request.uri.path)"
						}
					}
				}
			}]
		}
	}
}
