import { ManagedZone } from "../domains";

export const fbomLive = new ManagedZone("fbom-live", {
  domain: "fbom.live",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupShortiO("@");
