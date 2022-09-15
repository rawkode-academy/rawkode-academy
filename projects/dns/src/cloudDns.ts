import * as pulumi from "@pulumi/pulumi";
import * as gandi from "@pulumiverse/gandi";
import * as google from "@pulumi/google-native";

import { ManagedZone } from "./domains";

export const createZone = (managedZone: ManagedZone): pulumi.Resource[] => {
  const zone = new google.dns.v1.ManagedZone(
    managedZone.name,
    {
      dnsName: `${managedZone.zone.domain}.`,
      ...managedZone.zone,
    },
    {
      deleteBeforeReplace: true,
      parent: managedZone,
    }
  );

  const nameservers = new gandi.domains.Nameservers(
    managedZone.name,
    {
      domain: managedZone.zone.domain,
      servers: zone.nameServers.apply((ns) =>
        ns.map((n) => n.replace(/\.$/, ""))
      ),
    },
    {
      deleteBeforeReplace: true,
      parent: zone,
    }
  );

  const records = managedZone.getRecords().map(
    (record) =>
      new google.dns.v1.ResourceRecordSet(
        `${managedZone.name}-${record.type}-${record.name}`.toLowerCase(),
        {
          managedZone: zone.name,
          ttl: record.ttl,
          type: record.type,
          rrdatas: record.values,
          name: pulumi.interpolate`${
            record.name == "@" ? "" : record.name + "."
          }${zone.dnsName}`,
        },
        {
          deleteBeforeReplace: true,
          parent: zone,
        }
      )
  );

  return [zone, nameservers, ...records];
};
