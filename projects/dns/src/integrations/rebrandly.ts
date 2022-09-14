import { DnsRecords } from "../types";

export const setupRebrandly = (subdomain: string): DnsRecords => ({
  rebrandly: {
    name: subdomain,
    type: "A",
    values: ["52.72.49.79"],
  },
});
