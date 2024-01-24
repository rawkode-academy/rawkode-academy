import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.com",
		Registrar.Cloudflare,
	)
		.enableGSuite({
			domainKey:
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyxgNH5V3781QIZqZe7y8uzJQrxwRxUhYyFdFQYTTT5v29zwRuoVR47txNKvWqx8beanDgykQjUKMWw5bpt5da7dv1yZxVjQfZRy2vOF+cjrLhz0unCWWfKhQk2f6zowzzE3T3O9jjETo+CLgJzzkuWPU0r5e/owBPTndTO6joUihbWFWWNk5hIIi2PcE7OzX2mBLc2k2RZoDn0z+iB3UGVTkbpBp5iQILHjR308UKUZ8jF6ZEfb2WTMvZL7nR2+rgD555PulDL1GnSPCnySfvTtuNtallmZPeXtnm4egoHmTL+OFakRCToIJppnt+AcQ3X/mXlU3wtxJTrP6u61SRwIDAQAB",
			spfIncludes: [],
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=tLlIPrsVkjMI2Klec6nYm_m6bNNwKOgvQZlyyxg0nBQ",
		);

	return managedDomain;
};
