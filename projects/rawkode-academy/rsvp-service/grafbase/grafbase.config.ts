import { config, graph } from "@grafbase/sdk";
import { getAuthProvider } from "./auth/index.js";

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

g.mutation("rsvpForEvent", {
	args: { eventId: g.string() },
	returns: g.boolean(),
	resolver: "rsvpForEvent",
});

export default config({
	graph: g,
	experimental: {
		codegen: true,
	},
	auth: {
		providers: [getAuthProvider(g)],
		rules: (rules) => {
			rules.private();
		},
	},
});
