import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const technologyType = {
	id: g.string(),
	name: g.string(),
	description: g.string(),
	license: g.string(),
	websiteUrl: g.string(),
	documentationUrl: g.string(),
	githubRepository: g.string(),
};

const technology = g
	.type("Technology", technologyType)
	.key("id", { select: "technologyById(id: $id)" });

g.mutation("createTechnology", {
	resolver: "create",
	returns: g.ref(technology),
	args: technologyType,
});

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
			rules.public().read();
			rules.private().create().update().delete();
		},
	},
});
