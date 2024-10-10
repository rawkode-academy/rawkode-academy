import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.academy",
		Registrar.Cloudflare,
	);

	managedDomain
		.enableGSuite({
			domainKey:
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
			spfIncludes: [],
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
		)
		.addCNameRecord("api", "api", "rawkode-academy-api.fly.dev")
		.addCNameRecord("stripe", "billing", "hosted-checkout.stripecdn.com")
		.addTextRecord(
			"stripe-acme",
			"_acme-challenge.billing",
			"sJV8MAy9curK26zz05xdgnDL3X6uf-2IEdua78oHimw",
		)
		.addTextRecord(
			"_atproto",
			"_atproto",
			"did=did:plc:qtpysarntxepux4to4dr4hgr",
		)
		.addCNameRecord(
			"clerk-accounts-portal",
			"accounts",
			"accounts.clerk.services",
		)
		.addCNameRecord(
			"clerk-frontend-api",
			"clerk",
			"frontend-api.clerk.services",
		)
		.addCNameRecord(
			"clerk-dkim-1",
			"clk._domainkey",
			"dkim1.yo4jsvea9l19.clerk.services",
		)
		.addCNameRecord(
			"clerk-dkim-2",
			"clk2._domainkey",
			"dkim2.yo4jsvea9l19.clerk.services",
		)
		.addCNameRecord(
			"workos-1",
			"em4779.platform",
			"u36670648.wl149.sendgrid.net",
		)
		.addCNameRecord(
			"workos-2",
			"wos._domainkey.platform",
			"wos.domainkey.u36670648.wl149.sendgrid.net",
		)
		.addCNameRecord(
			"workos-3",
			"wos2._domainkey.platform",
			"wos2.domainkey.u36670648.wl149.sendgrid.net",
		)
		.addCNameRecord("auth", "auth", "cname.workos-dns.com")
		.addCNameRecord(
			"zitadel",
			"zitadel",
			"production-ds3f3w.eu1.zitadel.cloud",
		).enableResend({
			subdomain: "send",
			domainKey:
				"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDJKsVRi83GwLUtyJ3Z6UWrp1onOlmGzQxErb6Y0m06+JPigyFr1HpdfiX1afgQ+kICp83pSY2/1J8eqr0Q+u29pu3Lpmhrm72DOZ4VuSOkQQh7E31PIuJlM0FD+SzdLWf9cx5PMWJbpCpw1CdbmzezBhL2J4qKxNLCTypaGmrfzwIDAQAB",
			mxValue: "feedback-smtp.eu-west-1.amazonses.com",
		});

	return managedDomain;
};
