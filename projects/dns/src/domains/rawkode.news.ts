import { Domain } from "../types";
import { DisableEmail } from "../integrations";

export const RawkodeNews: Domain = {
  name: "rawkode.news",
  records: {
    ...DisableEmail,
  },
};
