import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.community",
		Registrar.Gandi,
	);

	managedDomain.discourageEmail().setupShortIO("@");

	return managedDomain;
};
