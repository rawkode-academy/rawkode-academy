package zone

// #CloudflareEmailRouting receives the domain's mail with Cloudflare Email
// Routing. Email Routing owns its MX and DKIM records, which are read-only in
// the DNS API, so only the SPF record is managed here.
#CloudflareEmailRouting: {
	#Zone
	txt: "@": spf: value: "v=spf1 include:_spf.mx.cloudflare.net ~all"
}
