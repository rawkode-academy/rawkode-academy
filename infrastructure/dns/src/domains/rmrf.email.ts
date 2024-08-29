import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rmrf.email",
		Registrar.Cloudflare
	);

	managedDomain.enableFastmail();

	return managedDomain;
};
