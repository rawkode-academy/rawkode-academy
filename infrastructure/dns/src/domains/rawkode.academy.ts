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
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU"
		)
		.addCNameRecord("stripe", "billing", "hosted-checkout.stripecdn.com")
		.addTextRecord(
			"stripe-acme",
			"_acme-challenge.billing",
			"sJV8MAy9curK26zz05xdgnDL3X6uf-2IEdua78oHimw"
		)
		.addARecord("web", "@", "185.230.63.107")
		.addCNameRecord("www", "www", "pointing.wixdns.net")
		.addTextRecord(
			"_atproto",
			"_atproto",
			"did=did:plc:qtpysarntxepux4to4dr4hgr"
		)
		.addCNameRecord(
			"clerk-accounts-portal",
			"accounts",
			"accounts.clerk.services"
		)
		.addCNameRecord(
			"clerk-frontend-api",
			"clerk",
			"frontend-api.clerk.services"
		)
		.addCNameRecord(
			"clerk-dkim-1",
			"clk._domainkey",
			"dkim1.yo4jsvea9l19.clerk.services"
		)
		.addCNameRecord(
			"clerk-dkim-2",
			"clk2._domainkey",
			"dkim2.yo4jsvea9l19.clerk.services"
		)
		.addCNameRecord(
			"clerk-mail",
			"clkmail",
			"mail.yo4jsvea9l19.clerk.services"
		);

	return managedDomain;
};
