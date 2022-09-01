import { Domain } from "../types";
import { DisableEmail, setupShortIO } from "../integrations";

export const RawkodeCommunity: Domain = {
  name: "rawkode.community",
  records: {
    ...DisableEmail,
    ...setupShortIO("@"),
  },
};
