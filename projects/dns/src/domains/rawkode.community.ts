import { ManagedZone } from "../domains";

export const rawkodeCommunity = new ManagedZone("rawkode-community", {
  domain: "rawkode.community",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupShortiO("@");
