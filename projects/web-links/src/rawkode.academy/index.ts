import { Domain } from "../types";

const redirects: Domain = {
  defaultRedirect: "https://youtube.com/c/rawkode",
  redirects: {
    "shareyourproject": {
      to: "https://savvycal.com/rawkode/be-on-rawkode-live",
    },
    "share-your-project": {
      to: "https://savvycal.com/rawkode/be-on-rawkode-live",
    },
    hackdays: {
      to: "https://github.com/rawkode-academy/hackdays",
    },
  },
};

export default redirects;
