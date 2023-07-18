import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
  const managedDomain = new ManagedDomain(scope, "cloudnativecompass.fm", Registrar.Cloudflare);

  managedDomain
    .discourageEmail()
    .addCNameRecord("www", "www", "domains.transistor.fm")
    .addCNameRecord("@", "@", "www.cloudnativecompass.fm");

  return managedDomain;
};
