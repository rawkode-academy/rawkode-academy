import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"chappaai.dev",
		Registrar.Cloudflare,
	);

	managedDomain.discourageEmail();

	return managedDomain;
};
