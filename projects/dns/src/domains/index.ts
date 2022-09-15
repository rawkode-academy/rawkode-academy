import * as pulumi from "@pulumi/pulumi";

import { ChappaaiDev } from "./chappaai.dev";
import { FBOMDev } from "./fbom.dev";
import { KlusteredLive } from "./klustered.live";
import { RawkoDe } from "./rawko.de";
import { RawkodeChat } from "./rawkode.chat";
import { RawkodeCom } from "./rawkode.com";
import { RawkodeCommunity } from "./rawkode.community";
import { rawkodeDev } from "./rawkode.dev";
import { RawkodeLink } from "./rawkode.link";
import { RawkodeNews } from "./rawkode.news";
// export * from "./rawkode.email";
// export * from "./rawkode.sh";

export const AllDomains = [
  ChappaaiDev,
  // FBOMDev,
  KlusteredLive,
  RawkoDe,
  RawkodeChat,
  RawkodeCom,
  RawkodeCommunity,
  rawkodeDev,
  RawkodeLink,
  RawkodeNews,
];

interface Zone {
  domain: string;
  description: string;
}

type RecordType = "A" | "CNAME" | "MX" | "TXT";

interface Record {
  name: string;
  type: RecordType;
  ttl: number;
  values: string[];
}

export class ManagedZone extends pulumi.ComponentResource {
  public readonly name: string;
  public readonly zone: Zone;
  private records: Map<string, Record> = new Map();

  constructor(
    name: string,
    zone: Zone,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("dns:managed-zone", name, zone, opts);

    this.name = name;
    this.zone = zone;
  }

  public getRecords(): Record[] {
    return Array.from(this.records.values());
  }

  public addRecord(newRecord: Record): ManagedZone {
    if (this.records.has(`${newRecord.type}:${newRecord.name}`)) {
      throw new Error(
        `${newRecord.type} record for ${newRecord.name} already exists`
      );
    }

    this.records.set(`${newRecord.type}:${newRecord.name}`, newRecord);
    return this;
  }

  public mergeRecord(newRecord: Record): ManagedZone {
    const record = this.records.get(`${newRecord.type}:${newRecord.name}`);

    if (undefined === record) {
      return this.addRecord(newRecord);
    }

    record.ttl = newRecord.ttl < record.ttl ? newRecord.ttl : record.ttl;
    record.values = [...record.values, ...newRecord.values];

    this.records.set(`${record.type}:${record.name}`, record);

    return this;
  }

  public enableGSuite(): ManagedZone {
    this.addRecord({
      name: "@",
      type: "MX",
      ttl: 3600,
      values: [
        "1 aspmx.l.google.com.",
        "5 alt1.aspmx.l.google.com.",
        "5 alt2.aspmx.l.google.com.",
        "10 alt3.aspmx.l.google.com.",
        "10 alt4.aspmx.l.google.com.",
      ],
    });

    this.addRecord({
      name: "google._domainkey",
      type: "TXT",
      ttl: 300,
      values: [
        // TXT records need split into 255 byte chunks
        "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJAS",
        "WWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
      ],
    });

    this.mergeRecord({
      name: "@",
      type: "TXT",
      ttl: 300,
      values: ['"v=spf1 include:_spf.google.com ~all"'],
    });

    return this;
  }
}
