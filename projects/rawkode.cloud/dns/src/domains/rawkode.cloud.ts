import { ManagedZone } from "../domains";

export const rawkodeCloud = new ManagedZone("rawkode-cloud", {
  domain: "rawkode.cloud",
  description: "Managed by Pulumi",
}).disableEmail();
