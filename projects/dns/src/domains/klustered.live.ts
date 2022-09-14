import { Domain } from "../types";
import { DisableEmail, setupRebrandly } from "../integrations";

export const KlusteredLive: Domain = {
  name: "klustered.live",
  records: {
    ...DisableEmail,
    ...setupRebrandly("@"),
  },
};
