package zone

#Zone: gmail?: {
	// Public key from Google Workspace → Apps → Gmail → Authenticate email.
	domainKey!: string
}

// #Gmail routes the domain's mail to Google Workspace.
#Gmail: {
	#Zone
	gmail: _
	mx: "@": "smtp.google.com": priority: 1
	txt: {
		"@": spf: value:                  "v=spf1 include:_spf.google.com -all"
		"google._domainkey": dkim: value: "v=DKIM1; k=rsa; p=\(gmail.domainKey)"
	}
}
