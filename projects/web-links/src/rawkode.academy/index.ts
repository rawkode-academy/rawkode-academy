import { Domain } from "../types";

const redirects: Domain = {
  defaultRedirect: "https://youtube.com/c/rawkode",
  redirects: {
    "shareyourproject": {
      to: "https://savvycal.com/RawkodeAcademy/share-your-project",
    },
    "share-your-project": {
      to: "https://savvycal.com/RawkodeAcademy/share-your-project",
    },
    hackdays: {
      to: "https://github.com/rawkode-academy/hackdays",
    },
  },
};

export default redirects;
