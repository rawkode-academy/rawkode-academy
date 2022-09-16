import { ManagedZone } from "../domains";

export const rawkodeLink = new ManagedZone("rawkode-link", {
  domain: "rawkode.link",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupShortiO("@");
