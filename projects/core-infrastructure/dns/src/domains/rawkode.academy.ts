import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.academy",
		Registrar.Cloudflare,
	);

	managedDomain
    .enableFastmail()
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
		)
		.addCNameRecord("api", "api", "rawkodeacademy-api.hasura.app")
		.addCNameRecord("community", "community", "rawkode-academy.circle.so")
		.addCNameRecord("connect", "connect", "26236635.sites.hscoscdn-eu1.net.")
    .addCNameRecord("crm", "crm", "26236635.sites.hscoscdn-eu1.net.")
    .addTextRecord("_atproto", "_atproto", "did=did:plc:qtpysarntxepux4to4dr4hgr");

	return managedDomain;
};
