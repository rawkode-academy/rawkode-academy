export interface DnsRecord {
  name: string;
  type: "A" | "CNAME" | "TXT" | "MX";
  values: string[];
}

export interface DnsRecords {
  [name: string]: DnsRecord;
}

export interface Domain {
  name: string;
  records: DnsRecords;
}
