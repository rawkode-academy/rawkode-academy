package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.academy": zone.#CloudflareRegistrar & zone.#Gmail & {
	id: "789be9a4588576db675cc2053ea3a89d"
	settings: {
		ssl:     "strict"
		tls_1_3: "zrt"
	}

	gmail: domainKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB"

	cname: {
		// SavvyCal booking pages and its Postmark bounce domain.
		meet: target:         "custom.savvycal.com"
		"pm-bounces": target: "pm.mtasv.net"
		// Stripe hosted checkout.
		billing: target: "hosted-checkout.stripecdn.com"
		// ngrok tunnel and its certificate validation.
		chat: target:              "4jmjcjsjgzr21ajws.3lyx2xaemnxqc5pvq.ngrok-cname.com"
		"_acme-challenge": target: "2dvgjohnq.acme-challenge.ngrok-dns.com"
		grafana: target:           "rawkodeacademy.grafana.net"
		rpc: {target: "rawkode-academy-rpc.pages.dev", proxied: true}
	}

	txt: {
		"@": "google-site-verification": {value: "google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU", ttl: 300}
		"_acme-challenge.billing": stripe: value: "sJV8MAy9curK26zz05xdgnDL3X6uf-2IEdua78oHimw"
		"_atproto": bluesky: {value: "did=did:plc:qtpysarntxepux4to4dr4hgr", ttl: 300}
		"_dmarc": dmarc: value:                         "v=DMARC1;  p=reject; rua=mailto:8ace6880c8424bc0b933ec999b35c3e2@dmarc-reports.cloudflare.net"
		"_gh-rawkodeacademy-o": github: value:          "0dcb5aad05"
		"default._bimi": bimi: value:                   "v=BIMI1; l=https://rawkode.academy/icon-gradient-bimi.svg; a=;"
		"20250224144620pm._domainkey": savvycal: value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCIAjV3SWToVrZLC0ZqlPE58BLitE11e7+GBBZbZNyRBjeZObIo+PX7UbllD2MTiAKWEfO2DCvZYW5eavJUP+xvHH+nnDywsgW184Z7+lA/Oand3P9IaSGP/YhZ2NzJgoOMqK+TbrdP9+gIDXhFzLhxVn6T9+AI4jnp9dYbod9DLQIDAQAB"

		// Sample record to check the plan comment on the infrastructure PR.
		"_cuenv-plan-check": cuenv: value: "cuenv infrastructure plan comment check"
	}
}
