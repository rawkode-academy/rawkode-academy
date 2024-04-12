import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
  const managedDomain = new ManagedDomain(
		scope,
		"rawko.de",
		Registrar.DnsSimple
	);

  managedDomain
    .discourageEmail()
    .addCNameRecord("vista-social", "@", "vist.ly", false);

  return managedDomain;
};
