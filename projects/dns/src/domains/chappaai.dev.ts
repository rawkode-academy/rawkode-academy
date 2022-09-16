import { ManagedZone } from "../domains";

export const chappaaiDev = new ManagedZone("chappaai-dev", {
  domain: "chappaai.dev",
  description: "Managed by Pulumi",
}).disableEmail();
