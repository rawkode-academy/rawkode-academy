package zone

// #DNSimpleRegistrar is for domains registered with DNSimple. Their delegation
// to Cloudflare's name servers is in infrastructure/bootstrap, because
// DNSimple has no read-only tokens and pull request plans must not hold one.
#DNSimpleRegistrar: {
	#Zone
	registrar: "dnsimple"
}
