import * as pulumi from "@pulumi/pulumi";
import * as gandi from "@pulumiverse/gandi";
import * as google from "@pulumi/google-native";

import { ManagedZone } from "../domains";

const chunkString = (value: string, length: number): string[] => {
  return Array.from(value.match(/.{1,254}/g)?.values() ?? []);
};

export const createZone = (
  managedZone: ManagedZone
): [string, google.dns.v1.ManagedZone] => {
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
      nameservers: zone.nameServers.apply((ns) =>
        ns.map((n) => n.replace(/\.$/, ""))
      ),
    },
    {
      deleteBeforeReplace: true,
      parent: zone,
    }
  );

  const records = managedZone.getRecords().map((record) => {
    const initialValue: string[] = [];

    const rrdatas: string[] = record.values.map((value) =>
      chunkString(value, 255).join(" ")
    );

    return new google.dns.v1.ResourceRecordSet(
      `${managedZone.name}-${record.type}-${record.name}`.toLowerCase(),
      {
        managedZone: zone.name,
        ttl: record.ttl,
        type: record.type,
        rrdatas,
        name: pulumi.interpolate`${
          record.name == "@" ? "" : record.name + "."
        }${zone.dnsName}`,
      },
      {
        deleteBeforeReplace: true,
        parent: zone,
      }
    );
  });

  return [managedZone.zone.domain, zone];
};
