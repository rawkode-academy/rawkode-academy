import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(scope, "fbom.live", Registrar.Gandi);

	managedDomain.discourageEmail();

	return managedDomain;
};
