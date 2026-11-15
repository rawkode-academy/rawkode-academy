package zone

import "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_bot_management"

// #BotFightMode challenges requests Cloudflare recognises as bots before they
// reach the zone's Workers. On Free zones it can't exempt anything, and the
// Workers never see Cloudflare's verdict: bots are stopped or let through.
// Cloudflare refuses Bot Fight Mode unless JavaScript detections are on.
#BotFightMode: {
	#Zone
	id:    _
	_slug: _
	resources: "\(_slug)_bot-management": cloudflare_bot_management.#Resource & {
		configuration: {zone_id: id, fight_mode: true, enable_js: true}
	}
}
