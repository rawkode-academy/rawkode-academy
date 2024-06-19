import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare
	)
		.enableGSuite({
			domainKey:
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyX8FNtHqb5A2or0OPpwb3sDMpj7IK5slZ6xdO2ts0l81U4+ZcXv5ga00xcezL+FoOOCG5bOr97GlNhegP3hf0Lb71qcJC20YS4IOkSZfR/Xo9dMZ/W1q7MaeryFf4OAPdmMjmJi6qmUrKjruEYuSysB3Rk3WqXWBI3fzFwU8+8OYcXUdES4uuL2/YFbBpL4SQMr8bKq4lRws2ye8ObY6KsImhg2Av6a5OoXnE5hRxC19fq/xZTNbyWdFApB5dbj6/xHRI6eVgv5xRD0FxrsCQZKCwJhGLm9yBljg7GqLk4DROLFqSBqOa8AwkiOc3/Vt52JsqKnNTHE+TAMJKC5HyQIDAQAB",
			spfIncludes: [],
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
