import { Domain } from "../types";
import { DisableEmail } from "../integrations";

export const RawkodeEmail: Domain = {
  name: "rawkode.email",
  records: {
    ...DisableEmail,
  },
};
