import type { Domain } from "../types";

// klustered.live is decommissioned; the public show now lives on the website.
const SHOW = "https://rawkode.academy/shows/klustered";

const redirects: Domain = {
	defaultRedirect: SHOW,
	redirects: {
		brackets: { to: `${SHOW}/brackets` },
		schedule: { to: `${SHOW}/schedule` },
		leaderboard: { to: `${SHOW}/leaderboard` },
		apply: { to: `${SHOW}/apply` },
		"schedule.ics": {
			to: "https://rawkode.academy/api/shows/klustered/schedule.ics",
		},
	},
};

export default redirects;
