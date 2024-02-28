import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

g.type("Show", {
	id: g.string(),
	hosts: g.string().list().resolver("hostsForShow"),
}).key("id");

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
