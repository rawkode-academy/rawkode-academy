import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
  const managedDomain = new ManagedDomain(scope, "cloudnativecompass.fm", Registrar.Gandi);

  managedDomain
    .discourageEmail()
    .addCNameRecord("www", "www", "domains.transistor.fm")
    .addARecord("@", "@", "www.cloudnativecompass.fm");

  return managedDomain;
};
