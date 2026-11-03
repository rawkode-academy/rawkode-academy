package zone

import (
	"registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_universal_ssl_setting"
	"registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_zone_setting"
)

#Zone: {
	id:    _
	_slug: _

	// The baseline every zone was created with; zones override individual
	// settings to match what is live.
	settings: {
		cname_flattening:         *"flatten_at_root" | "flatten_all"
		always_use_https:         *"on" | "off"
		automatic_https_rewrites: *"on" | "off"
		opportunistic_encryption: *"on" | "off"
		min_tls_version:          *"1.2" | "1.0" | "1.1" | "1.3"
		tls_1_3:                  *"on" | "off" | "zrt"
		ssl:                      *"flexible" | "off" | "full" | "strict"
	}

	resources: {
		for setting, value in settings {
			"\(_slug)_setting_\(setting)": cloudflare_zone_setting.#Resource & {
				configuration: {zone_id: id, setting_id: setting, "value": value}
			}
		}

		"\(_slug)_universal-ssl": cloudflare_universal_ssl_setting.#Resource & {
			configuration: {zone_id: id, enabled: true}
		}
	}
}
