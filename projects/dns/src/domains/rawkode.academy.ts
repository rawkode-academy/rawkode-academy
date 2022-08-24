import { Domain } from "../domains";

export const RawkodeAcademy: Domain = {
  name: "rawkode-academy",
  domain: "rawkode.academy",
  records: {
    mx1: {
      name: "@",
      type: "MX",
      priority: 1,
      value: "aspmx.l.google.com",
      proxied: false,
    },
    mx2: {
      name: "@",
      type: "MX",
      priority: 5,
      value: "alt1.aspmx.l.google.com",
      proxied: false,
    },
    mx3: {
      name: "@",
      type: "MX",
      priority: 5,
      value: "alt2.aspmx.l.google.com",
      proxied: false,
    },
    mx4: {
      name: "@",
      type: "MX",
      priority: 10,
      value: "alt3.aspmx.l.google.com",
      proxied: false,
    },
    mx5: {
      name: "@",
      type: "MX",
      priority: 10,
      value: "alt4.aspmx.l.google.com",
      proxied: false,
    },
    txt1: {
      name: "@",
      type: "TXT",
      value: '"v=spf1 include:_spf.google.com ~all"',
      proxied: false,
    },
    dkim1: {
      name: "google._domainkey",
      type: "TXT",
      value:
        "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
      proxied: false,
    },
  },
};
