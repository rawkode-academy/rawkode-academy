import { ManagedZone } from "../domains";

export const rawkodeDev = new ManagedZone("rawkode-dev", {
  domain: "rawkode.dev",
  description: "Managed by Pulumi",
})
  .enableFastmail()
  .addRecord({
    name: "fm1._domainkey",
    type: "CNAME",
    ttl: 300,
    values: ["fm1.rawkode.dev.dkim.fmhosted.com."],
  })
  .addRecord({
    name: "fm2._domainkey",
    type: "CNAME",
    ttl: 300,
    values: ["fm2.rawkode.dev.dkim.fmhosted.com."],
  })
  .addRecord({
    name: "fm3._domainkey",
    type: "CNAME",
    ttl: 300,
    values: ["fm3.rawkode.dev.dkim.fmhosted.com."],
  });
