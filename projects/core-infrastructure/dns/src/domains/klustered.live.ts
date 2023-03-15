import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"klustered.live",
		Registrar.Gandi,
	);

	managedDomain.discourageEmail().setupRebrandly("@");

	return managedDomain;
};
