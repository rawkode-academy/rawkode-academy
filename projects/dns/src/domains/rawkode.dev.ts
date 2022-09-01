import { Domain } from "../types";
import { GSuite } from "../integrations";

const domain: Domain = {
  name: "rawkode.dev",
  records: {
    ...GSuite,
  },
};

export default domain;
