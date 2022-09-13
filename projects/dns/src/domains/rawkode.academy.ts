import { Domain } from "../types";
import { GSuite } from "../integrations";

export const RawkodeAcademy: Domain = {
  name: "rawkode.academy",
  records: {
    ...GSuite,
    firebaseTxt: {
      name: "@",
      type: "TXT",
      values: [
        "google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
      ],
    },
  },
};
