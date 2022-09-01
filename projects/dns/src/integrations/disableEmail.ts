import { DnsRecords } from "../types";

export const DisableEmail: DnsRecords = {
  spf: {
    name: "@",
    type: "TXT",
    values: ['"v=spf1 ~all"'],
  },
};
