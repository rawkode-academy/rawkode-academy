import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.dev",
		Registrar.Cloudflare,
	)
		.enableGSuite({
			domainKey:
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhiWae1/qb61lZzpUW8pnwS+97DkHVdjz42VV27sGvA1NRdXNh1qN2Yh7p8na6riahggJO+YLKuPSK35NUPqceDZCvtv0jdnO3drifcmL8ZeI8xcn421H19UrUajV8Qow9ZnErLMlHlbr7zBl6aJthUYtGEACTsWUwTY3mCeM3r5iEDJBPpTu8GGkGoBktJJx5GoadQ7T821J1c4LqXU9ZF8Gqtq0rL3QUf4aQxsHbJeJQLzrDmpDV6xHTJOBk+JNRYD2DZWv0LxBD3eJGa40gvqfsx5SeD6XlSX5JuzHJjiCUBdjL4CMtdEt0lQWetF22TQ9wCz8hwhwzv7qGW099wIDAQAB",
			spfIncludes: [],
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=RnbvxDOTdobTiAetVoa-U3Xc0Irk76nan_OcRCGuQTM",
		)
		.addTextRecord(
			"_atproto",
			"_atproto",
			"did=did:plc:35bdlgus7hihmup66o265nuy",
		);

	return managedDomain;
};
