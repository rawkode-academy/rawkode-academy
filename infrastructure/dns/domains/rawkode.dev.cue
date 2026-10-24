package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.dev": zone.#CloudflareRegistrar & zone.#Gmail & {
	id:     "5ac7a43018d8b6fa2e0add5e2b94d2e7"
	dnssec: "disabled"
	settings: {
		ssl:              "full"
		always_use_https: "off"
		min_tls_version:  "1.0"
	}

	gmail: domainKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm2cW65PANp1Ti8SIYhg4mgZ7Qet0BjJouuCdAM4WZaOgqoyjWutUu5FiDB+RergEhfANiFTlolhfKe9UofG0dpFK6fIg0xt51w4V26S0YGFubbY8rYo1m0IilEqmXbTeP0tR9Lx6AVvMZBpGshYs5nfg5TNlcwW4Q29IcqV5KNDbD93kY+glmlCvgYg5gzbag3F2409SP/YoHDo3eRIwztbTCyNK9PdXS5YhK8Z0lGUurwrWipK33GwSJIEt1IPgCOeutaYJPxL2sNcDdS19onxong/4k4RlR23iZHfbuOrn593/ixzNrxhlKbG4bozrjX0Ag4fY34VjJ24NaVZu4wIDAQAB"

	mx: "@": "smtp.google.com": ttl: 3600
	txt: {
		"@": {
			"google-site-verification": value: "google-site-verification=RnbvxDOTdobTiAetVoa-U3Xc0Irk76nan_OcRCGuQTM"
			apple: {value: "apple-domain=hTUfoO5bLwq9Wisb", ttl: 3600}
		}
		"_dmarc": dmarc: value: "v=DMARC1;  p=reject; rua=mailto:918223e32cc34079ab2d9b0513124238@dmarc-reports.cloudflare.net,mailto:39ae0f24899d499b8b138f351cc0a58d@dmarc-reports.cloudflare.net"
	}
}
