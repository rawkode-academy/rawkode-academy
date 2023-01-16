import { Construct } from "constructs";
import { ManagedDomain, Account } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.cloud",
		Account.Academy,
	);

	managedDomain.discourageEmail();
	return managedDomain;
};
