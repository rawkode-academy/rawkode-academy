import { config, graph } from "@grafbase/sdk";

const g = graph.Standalone({ subgraph: true });

const chapter = g.type("Chapter", {
	timestamp: g.string(),
	title: g.string(),
});

const video = g
	.type("Video", {
		id: g.string(),
		title: g.string(),
		description: g.string(),
		show: g.string().optional(),
		type: g.string(),
		visibility: g.string(),
		publishedAt: g.datetime(),
		duration: g.int(),
		chapters: g.ref(chapter).list(),
	})
	.key("id", { select: "videoById(id: $id)" });

g.query("videos", {
	returns: g.ref(video).list(),
	resolver: "videos",
});

g.query("videoById", {
	args: { id: g.string() },
	returns: g.ref(video),
	resolver: "video",
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
