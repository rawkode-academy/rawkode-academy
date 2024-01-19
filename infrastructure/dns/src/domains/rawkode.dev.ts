import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare,
	)
		.enableMicrosoft365({
			txtVerification: "MS=ms86636100",
			spfIncludes: [],
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=RnbvxDOTdobTiAetVoa-U3Xc0Irk76nan_OcRCGuQTM",
		)
		.addARecord("@1", "@", "3.130.60.26")
		.addARecord("@2", "@", "3.13.222.255")
		.addARecord("@3", "@", "3.13.246.91")
		.addTextRecord(
			"_atproto",
			"_atproto",
			"did=did:plc:35bdlgus7hihmup66o265nuy",
		);

	return managedDomain;
};
