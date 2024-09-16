import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const event = g
	.type("Event", {
		id: g.string(),
		name: g.string(),
		show: g.string().optional(),
		type: g.string(),
		description: g.string(),
		startsAt: g.datetime(),
		endsAt: g.datetime(),
	})
	.key("id", { select: "eventById(id: $id)" });

g.query("events", {
	returns: g.ref(event).list(),
	resolver: "events",
});

g.query("eventById", {
	args: { id: g.string() },
	returns: g.ref(event),
	resolver: "event",
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
