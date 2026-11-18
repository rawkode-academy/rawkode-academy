import type { Domain } from "../types";

// klustered.live is decommissioned; every path lands on the Klustered
// holding page on the website.
const SHOW = "https://rawkode.academy/shows/klustered";

const redirects: Domain = {
	defaultRedirect: SHOW,
	redirects: {},
};

export default redirects;
