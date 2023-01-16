import { Construct } from "constructs";
import { ManagedDomain, Account } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"klustered.live",
		Account.Academy,
	);

	managedDomain.discourageEmail().setupRebrandly("@");
	return managedDomain;
};
