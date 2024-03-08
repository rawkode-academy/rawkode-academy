import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const technology = g
	.type("Technology", {
		id: g.string(),
		name: g.string(),
		description: g.string(),
		license: g.string(),
		websiteUrl: g.string(),
		documentationUrl: g.string(),
		githubRepository: g.string(),
	})
	.key("id", { select: "technologyById(id: $id)" });

g.query("technologies", {
	resolver: "technologies",
	returns: g.ref(technology).list(),
});

g.query("technologyById", {
	args: { id: g.string() },
	resolver: "technology",
	returns: g.ref(technology),
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
