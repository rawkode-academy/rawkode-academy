import { DnsRecords } from "../types";

export const GSuite: DnsRecords = {
  dkim: {
    name: "google._domainkey",
    type: "TXT",
    values: [
      // TXT records need split into 255 byte chunks
      "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJAS",
      "WWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
    ],
  },
  mx: {
    name: "@",
    type: "MX",
    values: [
      "1 aspmx.l.google.com.",
      "5 alt1.aspmx.l.google.com.",
      "5 alt2.aspmx.l.google.com.",
      "10 alt3.aspmx.l.google.com.",
      "10 alt4.aspmx.l.google.com.",
    ],
  },
  spf: {
    name: "@",
    type: "TXT",
    values: ['"v=spf1 include:_spf.google.com ~all"'],
  },
};
