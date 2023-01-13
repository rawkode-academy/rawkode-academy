import { ManagedZone } from "../domains";

export const rawkodeAcademy = new ManagedZone("rawkode-academy", {
  domain: "rawkode.academy",
  description: "Managed by Pulumi",
})
  .enableGSuite()
  .mergeRecord({
    type: "TXT",
    name: "@",
    ttl: 300,
    values: [
      "google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
    ],
  })
  .addRecord({
    name: "google._domainkey",
    type: "TXT",
    ttl: 300,
    values: [
      "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
    ],
  })
  .addRecord({ type: "A", name: "@", ttl: 300, values: ["199.36.158.100"] });
