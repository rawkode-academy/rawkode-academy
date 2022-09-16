import { ManagedZone } from "../domains";

export const rawkodeDe = new ManagedZone("rawko-de", {
  domain: "rawko.de",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupShortiO("@");
