import { Domain } from "../types";
import { DisableEmail, setupShortIO } from "../integrations";

export const RawkodeChat: Domain = {
  name: "rawkode.chat",
  records: {
    ...DisableEmail,
    ...setupShortIO("@"),
  },
};
