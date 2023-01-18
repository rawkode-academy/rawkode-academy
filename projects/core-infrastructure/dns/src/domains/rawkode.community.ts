import { Construct } from "constructs";
import { ManagedDomain, Account } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.community",
		Account.Academy,
	);

	managedDomain
		.discourageEmail()
		.addCNameRecord("@", "hashnode.network")
		.addCNameRecord("www", "hashnode.network");
	return managedDomain;
};
