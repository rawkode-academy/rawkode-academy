import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	return new ManagedDomain(
		scope,
		"rmrf.email",
		Registrar.Cloudflare,
	).enableFastmail();
};
