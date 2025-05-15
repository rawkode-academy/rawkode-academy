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
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvslTU5QuSpPOgpjONa9PsrpzmD4Mm61fFZwyy+ZJ/WcIXEYASwzOrd7SXrxkWrQfb48X8nyB8WBd21xbxx9NOHsHELfoDnKOWe9APj2T3f6Arcg3SEbh03R+4OXTJrTLe9VudB4TjHWGzOcVDeIQDpmnWzAl+oRwQeLGzUII2+cPY0yJGhMAP2cB/Me4II+eCAg5jBMr3QGvCPoUW/9laFiPDJ6T+7ctCUjTVoULDDIug+Jeu/1ES7Bgz5QBLE1Manp7o8FYU8ASQr9RxGtNPq1EEy5RL2fXrJ2On7rcWG6M5eV5EvjG4kPJuxKNGgHaiZhDNhjb1pLf7L1Gtm87+wIDAQAB",
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
