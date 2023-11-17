import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.email",
		Registrar.Cloudflare,
	);

  managedDomain.enableBumpEmail({
    domainKey: "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuy/HI1Y36lm2Co/qRXxJuOcmUNuZX8t9R2W+vlGZd9CAUmIgtD1G8LUPPW2oZChsiGqAtQv7mlLNJOns5hkeD9M+DqfRtG+WcCxj3UrfzCTapIGznJpafcTfrSnGdm5WACltyHN3toxQsSIdrUeFfhaIGeAexGw4hinfsuD8O+wIDAQAB"
  });

	return managedDomain;
};
