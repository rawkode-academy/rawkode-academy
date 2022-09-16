import { ManagedZone } from "../domains";

export const klusteredLive = new ManagedZone("klustered-live", {
  domain: "klustered.live",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupRebrandly("@");
