import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.social",
		Registrar.Cloudflare,
	).addARecord("mastodon", "@", "94.23.75.107");

	return managedDomain;
};
