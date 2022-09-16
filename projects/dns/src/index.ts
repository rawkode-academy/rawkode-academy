import * as google from "@pulumi/google-native";
import * as gandi from "@pulumiverse/gandi";
import {
  DnsKeySpecAlgorithm,
  DnsKeySpecKeyType,
  ManagedZoneDnsSecConfigNonExistence,
  ManagedZoneDnsSecConfigState,
} from "@pulumi/google-native/dns/v1";
import * as gcp from "@pulumi/gcp";

import { Domain } from "./types";
import { AllDomains } from "./domains";
import { createZone } from "./dnsProviders/cloudDns";

import { rawkodeAcademy } from "./domains/rawkode.academy";
createZone(rawkodeAcademy);
import { rawkodeDev } from "./domains/rawkode.dev";
createZone(rawkodeDev);
import { rawkodeCom } from "./domains/rawkode.com";
createZone(rawkodeCom);

const reconcileDomain = (domain: Domain) => {
  const resourceName = domain.name.replace(/\./g, "-");

  const zone = new gcp.dns.ManagedZone(resourceName, {
    dnsName: `${domain.name}.`,
    description: "Managed DNS by Pulumi",
    dnssecConfig: {
      defaultKeySpecs: [
        {
          algorithm: DnsKeySpecAlgorithm.Ecdsap256sha256,
          keyType: DnsKeySpecKeyType.KeySigning,
          keyLength: 256,
        },
        {
          algorithm: DnsKeySpecAlgorithm.Ecdsap256sha256,
          keyType: DnsKeySpecKeyType.ZoneSigning,
          keyLength: 256,
        },
      ],
      nonExistence: ManagedZoneDnsSecConfigNonExistence.Nsec3,
      state: ManagedZoneDnsSecConfigState.Off,
    },
  });

  const nameservers = new gandi.domains.Nameservers(
    resourceName,
    {
      domain: domain.name,
      servers: zone.nameServers.apply((ns) =>
        ns.map((n) => n.replace(/\.$/, ""))
      ),
    },
    {
      parent: zone,
    }
  );

  // const dnsPublicKey = zone.name.apply((name) =>
  //   gcp.dns.getKeysOutput({
  //     managedZone: name,
  //   })
  // );

  // dnsPublicKey.zoneSigningKeys.apply((publicKey) => {
  //   new gandi.domains.DNSSecKey(
  //     `${resourceName}-zsk`,
  //     {
  //       domain: domain.name,
  //       publicKey: publicKey[0].publicKey,
  //       type: "zsk",
  //       algorithm: 13, // 13 is ECDSA-P256-SHA256
  //     },
  //     {
  //       parent: nameservers,
  //       dependsOn: [nameservers, zone],
  //     }
  //   );
  // });

  // dnsPublicKey.keySigningKeys.apply((publicKey) => {
  //   new gandi.domains.DNSSecKey(
  //     `${resourceName}-psk`,
  //     {
  //       domain: domain.name,
  //       publicKey: publicKey[0].publicKey,
  //       type: "ksk",
  //       algorithm: 13, // 13 is ECDSA-P256-SHA256
  //     },
  //     {
  //       parent: nameservers,
  //       dependsOn: [nameservers, zone],
  //     }
  //   );
  // });

  Object.keys(domain.records).forEach((key) => {
    const record = domain.records[key];

    new google.dns.v1.ResourceRecordSet(
      `${resourceName}-${key}`,
      {
        // Google Cloud DNS doesn't accept "@" as a root name, so we need to
        // qualify it as my-domain.com.
        name:
          record.name == "@"
            ? `${domain.name}.`
            : `${record.name}.${domain.name}.`,
        managedZone: zone.name,
        type: record.type,
        ttl: 300,
        rrdatas: record.values,
      },
      {
        parent: zone,
      }
    );
  });
};

Object.values(AllDomains).forEach((domain) => {
  reconcileDomain(domain);
});
