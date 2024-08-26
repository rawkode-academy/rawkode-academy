import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare
	)
		.enableFastmail()
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=RnbvxDOTdobTiAetVoa-U3Xc0Irk76nan_OcRCGuQTM"
		)
		.addTextRecord(
			"_atproto",
			"_atproto",
			"did=did:plc:35bdlgus7hihmup66o265nuy"
		);

	return managedDomain;
};
