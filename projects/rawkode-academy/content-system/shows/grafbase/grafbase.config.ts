import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const show = g.type("Show", {
	id: g.string(),
	name: g.string(),
	hosts: g.string().list(),
});

g.query("shows", {
	returns: g.ref(show).list(),
	resolver: "shows",
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
