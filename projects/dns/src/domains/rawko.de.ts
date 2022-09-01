import { Domain } from "../types";
import { DisableEmail, setupShortIO } from "../integrations";

export const RawkoDe: Domain = {
  name: "rawko.de",
  records: {
    ...DisableEmail,
    ...setupShortIO("@"),
  },
};
