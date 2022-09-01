import { Domain } from "../types";
import { DisableEmail } from "../integrations";

export const ChappaaiDev: Domain = {
  name: "chappaai.dev",
  records: {
    ...DisableEmail,
  },
};
