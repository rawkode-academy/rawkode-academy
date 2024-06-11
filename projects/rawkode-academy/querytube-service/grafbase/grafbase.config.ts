import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const youtubeVideo = g
	.type("YouTubeVideo", {
		id: g.string(),
		title: g.string(),
		streamedLive: g.boolean(),
		description: g.string(),
		date: g.datetime(),
	})
	.key("id");

g.query("youtubeVideos", {
	returns: g.ref(youtubeVideo).list(),
	resolver: "youtubeVideos",
});

export default config({
	graph: g,
	codegen: {
		enabled: true,
	},
	auth: {
		rules: (rules) => {
			rules.public();
		},
	},
});
