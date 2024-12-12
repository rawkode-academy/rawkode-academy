import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.academy",
		Registrar.Cloudflare,
	);

	managedDomain
		.enableMicrosoft365({
			txtVerification: "MS=ms14506945",
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
		)
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
		.addTextRecord(
			"bimi",
			"default._bimi",
			`v=BIMI1; l=https://rawkode.academy/icon-gradient-bimi.svg; a=;`,
		)
		.enableResend({
			subdomain: "send",
			domainKey:
				"MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDJKsVRi83GwLUtyJ3Z6UWrp1onOlmGzQxErb6Y0m06+JPigyFr1HpdfiX1afgQ+kICp83pSY2/1J8eqr0Q+u29pu3Lpmhrm72DOZ4VuSOkQQh7E31PIuJlM0FD+SzdLWf9cx5PMWJbpCpw1CdbmzezBhL2J4qKxNLCTypaGmrfzwIDAQAB",
			mxValue: "feedback-smtp.eu-west-1.amazonses.com",
		});

	return managedDomain;
};
