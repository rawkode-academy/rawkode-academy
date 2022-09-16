import { ManagedZone } from "../domains";

export const rawkodeEmail = new ManagedZone("rawkode-mail", {
  domain: "rawkode.email",
  description: "Managed by Pulumi",
}).disableEmail();
