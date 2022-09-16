import { ManagedZone } from "../domains";

export const rawkodeSh = new ManagedZone("rawkode-sh", {
  domain: "rawkode.sh",
  description: "Managed by Pulumi",
}).disableEmail();
