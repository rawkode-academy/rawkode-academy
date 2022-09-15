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
  .addRecord({ type: "A", name: "@", ttl: 300, values: ["199.36.158.100"] });
