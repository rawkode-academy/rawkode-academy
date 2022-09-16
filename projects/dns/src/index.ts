import { createZone } from "./dnsProviders/cloudDns";

import { rawkodeAcademy } from "./domains/rawkode.academy";
createZone(rawkodeAcademy);

import { rawkodeDev } from "./domains/rawkode.dev";
createZone(rawkodeDev);

import { rawkodeCom } from "./domains/rawkode.com";
createZone(rawkodeCom);

import { chappaaiDev } from "./domains/chappaai.dev";
createZone(chappaaiDev);

import { fbomDev } from "./domains/fbom.dev";
createZone(fbomDev);

import { klusteredLive } from "./domains/klustered.live";
createZone(klusteredLive);

import { rawkodeDe } from "./domains/rawko.de";
createZone(rawkodeDe);

import { rawkodeChat } from "./domains/rawkode.chat";
createZone(rawkodeChat);

// Not migrated to Gandi yet (ever?)
// import { rawkodeEmail } from "./domains/rawkode.email";
// createZone(rawkodeEmail);

import { rawkodeLink } from "./domains/rawkode.link";
createZone(rawkodeLink);

import { rawkodeNews } from "./domains/rawkode.news";
createZone(rawkodeNews);

// Not migrated to Gandi yet (ever?)
// import { rawkodeSh } from "./domains/rawkode.sh";
// createZone(rawkodeSh);
