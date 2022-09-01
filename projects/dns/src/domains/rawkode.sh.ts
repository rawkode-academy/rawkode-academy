import { Domain } from "../types";
import { DisableEmail } from "../integrations";

export const RawkodeSh: Domain = {
  name: "rawkode.sh",
  records: {
    ...DisableEmail,
  },
};
