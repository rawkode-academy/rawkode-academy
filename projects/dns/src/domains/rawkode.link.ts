import { Domain } from "../types";
import { DisableEmail, setupShortIO } from "../integrations";

export const RawkodeLink: Domain = {
  name: "rawkode.link",
  records: {
    ...DisableEmail,
    ...setupShortIO("@"),
  },
};
