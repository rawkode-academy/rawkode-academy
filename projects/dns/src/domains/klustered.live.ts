import { Domain } from "../types";
import { DisableEmail, setupShortIO } from "../integrations";

export const KlusteredLive: Domain = {
  name: "klustered.live",
  records: {
    ...DisableEmail,
    ...setupShortIO("@"),
  },
};
