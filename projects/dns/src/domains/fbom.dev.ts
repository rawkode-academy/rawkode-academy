import { ManagedZone } from "../domains";

export const fbomDev = new ManagedZone("fbom-dev", {
  domain: "fbom.dev",
  description: "Managed by Pulumi",
}).disableEmail();
