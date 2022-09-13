import { Domain } from "../types";
import { DisableEmail } from "../integrations";

export const FBOMDev: Domain = {
  name: "fbom.dev",
  records: {
    ...DisableEmail,
    root: {
      name: "@",
      type: "A",
      values: ["148.105.251.17"],
    },
    www: {
      name: "www",
      type: "CNAME",
      values: ["us7-9eca242d-319861e8c0b21085e2f5db885.pages.mailchi.mp"],
    },
  },
};
