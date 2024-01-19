import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"alphabits.fm",
		Registrar.Cloudflare,
	);

	managedDomain
		.discourageEmail()
		.addCNameRecord("www", "www", "domains.transistor.fm")
		.addCNameRecord("@", "@", "www.alphabits.fm");

	return managedDomain;
};
