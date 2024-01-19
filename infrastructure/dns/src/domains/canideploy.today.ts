import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"canideploy.today",
		Registrar.Dynadot,
	);

	managedDomain
		.discourageEmail()
		.addARecord("@1", "@", "151.101.65.195")
		.addARecord("@2", "@", "151.101.1.195");

	return managedDomain;
};
