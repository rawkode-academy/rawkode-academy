import * as pulumi from "@pulumi/pulumi";

import { ChappaaiDev } from "./chappaai.dev";
import { FBOMDev } from "./fbom.dev";
import { KlusteredLive } from "./klustered.live";
import { RawkoDe } from "./rawko.de";
import { RawkodeAcademy } from "./rawkode.academy";
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
  RawkodeAcademy,
  RawkodeChat,
  RawkodeCom,
  RawkodeCommunity,
  rawkodeDev,
  RawkodeLink,
  RawkodeNews,
];

interface ManagedDomainArgs {
  domain: string;
  enableDnssec: boolean;
}

type RecordType = "A" | "CNAME" | "MX" | "TXT";
type RecordID = [RecordType, string];

interface Zone {
  name: string;
  description: string;
}

interface Record {
  values: string[];
  ttl: number;
}

export class ManagedDomain extends pulumi.ComponentResource {
  private name: string;
  private zone: Zone;
  private records: Map<string, Record> = new Map();

  constructor(
    name: string,
    args: ManagedDomainArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("rawkode:managed-domain", name, args, opts);

    this.name = name;
    this.zone = {
      name: `${args.domain}.`,
      description: "Managed DNS by Pulumi",
    };
  }

  private addRecord(recordID: RecordID, newValues: Record): void {
    if (this.records.has(`${recordID[0]}:${recordID[1]}`)) {
      throw new Error(`Record ${recordID} already exists`);
    }

    this.records.set(`${recordID[0]}:${recordID[1]}`, {
      ttl: newValues.ttl,
      values: newValues.values,
    });
  }

  private mergeRecord(recordID: RecordID, newValues: Record): void {
    console.debug(this.records);
    console.log(`Checking for ${recordID[0]} - ${recordID[1]}`);
    const record = this.records.get(`${recordID[0]}:${recordID[1]}`);

    if (undefined === record) {
      console.log("Doesn't exist");
      this.addRecord(recordID, newValues);
      return;
    }

    console.log("Exists");

    record.ttl = newValues.ttl < record.ttl ? newValues.ttl : record.ttl;
    record.values = [...record.values, ...newValues.values];

    this.records.set(`${recordID[0]}:${recordID[1]}`, record);
  }

  public enableGSuite(): ManagedDomain {
    this.addRecord(["MX", "@"], {
      ttl: 3600,
      values: [
        "1 aspmx.l.google.com.",
        "5 alt1.aspmx.l.google.com.",
        "5 alt2.aspmx.l.google.com.",
        "10 alt3.aspmx.l.google.com.",
        "10 alt4.aspmx.l.google.com.",
      ],
    });

    this.addRecord(["TXT", "google._domainkey"], {
      ttl: 300,
      values: [
        // TXT records need split into 255 byte chunks
        "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJAS",
        "WWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
      ],
    });

    this.mergeRecord(["TXT", "@"], {
      ttl: 300,
      values: ['"v=spf1 include:_spf.google.com ~all"'],
    });

    return this;
  }

  public addTxtRecord(recordID: RecordID, values: string[]): ManagedDomain {
    this.mergeRecord(recordID, {
      ttl: 300,
      values,
    });

    return this;
  }
}
