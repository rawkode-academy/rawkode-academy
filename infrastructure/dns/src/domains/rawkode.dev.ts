import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare
	)
		.enableProtonMail({
			verificationCode: "0b2988d284e63f924714e3ae1bc5fae4cf9223ca",
		})
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
