import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare,
	);

	managedDomain
    .enableFastmail()
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
		)
		.addARecord("@1", "@", "3.130.60.26")
		.addARecord("@2", "@", "3.13.222.255")
		.addARecord("@3", "@", "3.13.246.91")
		.addARecord("share1", "share", "104.21.59.78")
    .addARecord("share2", "share", "172.67.218.165")
    .addTextRecord("_atproto", "_atproto", "did=did:plc:35bdlgus7hihmup66o265nuy");

	return managedDomain;
};
