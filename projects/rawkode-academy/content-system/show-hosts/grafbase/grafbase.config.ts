import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const person = g
	.type("Person", {
		id: g.string(),
	})
	.key("id", { resolvable: false });

g.type("Show", {
	id: g.string(),
	hosts: g.ref(person).list().resolver("hostsForShow"),
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
