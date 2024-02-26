import { graph, config } from '@grafbase/sdk'

const g = graph.Standalone({ subgraph: true });

g.query("rsvpsForEvent", {
	args: { eventId: g.string() },
	returns: g.ref(
		g.type("EventRSVPs", {
			count: g.int(),
			userIds: g.string().list(),
		})
	),
	resolver: "rsvpsForEvent",
});

export default config({
	graph: g,
	experimental: {
		codegen: true,
	},
	auth: {
		rules: (rules) => {
			rules.public()
		},
	},
})
