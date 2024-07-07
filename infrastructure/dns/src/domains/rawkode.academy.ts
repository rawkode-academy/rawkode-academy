import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.academy",
		Registrar.Cloudflare
	);

	managedDomain
		.enableMicrosoft365({
			spfIncludes: [],
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU"
		)
		.addCNameRecord("api", "api", "api-main-rawkodeacademy.grafbase.app")
		.addCNameRecord("stripe", "billing", "hosted-checkout.stripecdn.com")
		.addTextRecord(
			"stripe-acme",
			"_acme-challenge.billing",
			"sJV8MAy9curK26zz05xdgnDL3X6uf-2IEdua78oHimw"
		)
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
