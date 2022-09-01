import { DnsRecords } from "../types";

export const setupShortIO = (subdomain: string): DnsRecords => ({
  shortIO: {
    name: subdomain,
    type: "A",
    values: ["52.21.33.16", "52.59.165.42"],
  },
});
