import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const person = g.type("Person", {
	id: g.string(),
	forename: g.string(),
	surnames: g.string(),
});

g.query("people", {
	returns: g.ref(person).list(),
	resolver: "people",
});

export default config({
	graph: g,
	experimental: {
		codegen: true,
	},
	auth: {
		rules: (rules) => {
			// Only our backend APIs should
			// be able to fetch people data
			// and they'll use machine tokens
			rules.groups(["this-group-doesn't-exist"]);
		},
	},
});
