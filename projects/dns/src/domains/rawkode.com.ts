import { Domain } from "../types";
import { GSuite } from "../integrations";

export const RawkodeCom: Domain = {
  name: "rawkode.com",
  records: {
    ...GSuite,
  },
};
