import * as pulumi from "@pulumi/pulumi";
import * as google from "@pulumi/google-native";
import { createZone } from "./dnsProviders/cloudDns";

let allZones: [string, google.dns.v1.ManagedZone][] = [];

import { rawkodeAcademy } from "./domains/rawkode.academy";
allZones.push(createZone(rawkodeAcademy));

import { rawkodeCom } from "./domains/rawkode.com";
allZones.push(createZone(rawkodeCom));

import { chappaaiDev } from "./domains/chappaai.dev";
allZones.push(createZone(chappaaiDev));

import { fbomDev } from "./domains/fbom.dev";
allZones.push(createZone(fbomDev));

import { fbomLive } from "./domains/fbom.live";
allZones.push(createZone(fbomLive));

import { klusteredLive } from "./domains/klustered.live";
allZones.push(createZone(klusteredLive));

import { rawkodeDe } from "./domains/rawko.de";
allZones.push(createZone(rawkodeDe));

import { rawkodeChat } from "./domains/rawkode.chat";
allZones.push(createZone(rawkodeChat));

// Not migrated to Gandi yet (ever?)
// import { rawkodeEmail } from "./domains/rawkode.email";
// createZone(rawkodeEmail);

import { rawkodeLink } from "./domains/rawkode.link";
allZones.push(createZone(rawkodeLink));

import { rawkodeNews } from "./domains/rawkode.news";
allZones.push(createZone(rawkodeNews));

// Not migrated to Gandi yet (ever?)
// import { rawkodeSh } from "./domains/rawkode.sh";
// createZone(rawkodeSh);

export const zoneNameMap = allZones.reduce<
  Record<string, pulumi.Output<string>>
>((zoneNameMap, [domain, zone]) => {
  return { ...zoneNameMap, [domain]: zone.name };
}, {});
