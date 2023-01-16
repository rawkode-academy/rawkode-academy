import { Construct } from "constructs";
import { ManagedDomain, Account } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(scope, "rawko.de", Account.Academy);

	managedDomain.discourageEmail().setupShortIO("@");
	return managedDomain;
};
