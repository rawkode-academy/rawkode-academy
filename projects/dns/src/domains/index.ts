import { RawkodeAcademy } from "./rawkode.academy";

interface DnsRecord {
  name: string;
  type: "A" | "CNAME" | "TXT" | "MX";
  value: string;
  proxied: boolean;
}

interface MxRecord extends DnsRecord {
  type: "MX";
  proxied: false;
  priority: number;
}

export interface Domain {
  name: string;
  domain: string;
  records: {
    [name: string]: DnsRecord | MxRecord;
  };
}

export const Domains: Domain[] = [RawkodeAcademy];
