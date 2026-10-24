package zone

// #Fastmail routes the domain's mail to Fastmail.
#Fastmail: {
	#Zone
	name: _
	mx: "@": {
		"in1-smtp.messagingengine.com": {priority: 1, ttl: 3600}
		"in2-smtp.messagingengine.com": {priority: 5, ttl: 3600}
	}
	txt: "@": spf: value: "v=spf1 include:spf.messagingengine.com ~all"
	cname: {
		for selector in ["fm1", "fm2", "fm3", "mesmtp"] {
			"\(selector)._domainkey": target: "\(selector).\(name).dkim.fmhosted.com"
		}
	}
	// These names match what is live, but Fastmail documents `_service._tcp`.
	srv: [string]: ttl: 3600
	srv: {
		"_submission_tcp": {weight: 1, port: 587, target: "smtp.fastmail.com"}
		"_imap_tcp": {weight: 0, port: 0, target: "."}
		"_imaps_tcp": {weight: 1, port: 993, target: "imap.fastmail.com"}
		"_jmap_tcp": {weight: 1, port: 443, target: "api.fastmail.com"}
		"_carddav_tcp": {weight: 0, port: 0, target: "."}
		"_carddavs_tcp": {weight: 1, port: 443, target: "carddav.fastmail.com"}
		"_caldav_tcp": {weight: 0, port: 0, target: "."}
		"_caldavs_tcp": {weight: 1, port: 443, target: "caldav.fastmail.com"}
	}
}
