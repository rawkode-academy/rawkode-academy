import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const shows = g.type("ShowList", {
	showIds: g.string().list(),
});

const hosts = g.type("HostList", {
	hostIds: g.string().list(),
});

g.query("hostsForShow", {
	args: {
		showId: g.string(),
	},
	returns: g.ref(hosts),
	resolver: "hostsForShow",
});

g.query("showsForHost", {
	args: {
		hostId: g.string(),
	},
	returns: g.ref(shows),
	resolver: "showsForHost",
});

export default config({
	graph: g,
	experimental: {
		codegen: true,
	},
	auth: {
		rules: (rules) => {
			rules.public();
		},
	},
});
