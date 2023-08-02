import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
  const managedDomain = new ManagedDomain(
    scope,
    "rawkode.email",
    Registrar.Cloudflare,
  );

  managedDomain
    .addCNameRecord(
      "hs1",
      "hs1-26236635._domainkey",
      "rawkode-email.hs12a.dkim.hubspotemail.net.",
    )
    .addCNameRecord(
      "hs2",
      "hs2-26236635._domainkey",
      "rawkode-email.hs12b.dkim.hubspotemail.net.",
    );

  return managedDomain;
};
