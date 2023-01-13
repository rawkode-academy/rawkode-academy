import * as pulumi from "@pulumi/pulumi";

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

  public disableEmail(): ManagedZone {
    this.mergeRecord({
      name: "@",
      type: "TXT",
      ttl: 300,
      values: ['"v=spf1 ~all"'],
    });

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

    this.mergeRecord({
      name: "@",
      type: "TXT",
      ttl: 300,
      values: ['"v=spf1 include:_spf.google.com ~all"'],
    });

    return this;
  }

  public enableFastmail(): ManagedZone {
    this.addRecord({
      name: "@",
      type: "MX",
      ttl: 3600,
      values: [
        "10 in1-smtp.messagingengine.com.",
        "20 in2-smtp.messagingengine.com.",
      ],
    });

    this.mergeRecord({
      name: "@",
      type: "TXT",
      ttl: 300,
      values: ['"v=spf1 include:spf.messagingengine.com ?all"'],
    });

    return this;
  }

  public setupRebrandly(name: string): ManagedZone {
    this.addRecord({
      name,
      type: "A",
      ttl: 300,
      values: ["52.72.49.79"],
    });

    return this;
  }

  public setupShortiO(name: string): ManagedZone {
    this.addRecord({
      name,
      type: "A",
      ttl: 300,
      values: ["52.21.33.16", "52.59.165.42"],
    });

    return this;
  }
}
