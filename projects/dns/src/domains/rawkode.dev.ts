import { Domain } from "../types";
import { GSuite } from "../integrations";

export const rawkodeDev: Domain = {
  name: "rawkode.dev",
  records: {
    ...GSuite,
  },
};
