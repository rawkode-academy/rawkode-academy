import { Domain } from "../types";
import { GSuite } from "../integrations";

export const RawkodeAcademy: Domain = {
  name: "rawkode.academy",
  records: {
    ...GSuite,
  },
};

// ❯ dog rawkode.academy TXT
// TXT rawkode.academy. 5m00s   "v=spf1 include:_spf.google.com ~all"
// TXT rawkode.academy. 5m00s   "google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU"
