import { tag, tags } from "@rawkodeacademy/content-model/tags";
import { defineModels, rowSchema, slug } from "@rawkodeacademy/content-write";
import { showHostsTable } from "../data-model/schema";

// One host; the show and the billing position come from the list.
const host = rowSchema(showHostsTable, { hostId: slug() })
	.pick({ hostId: true })
	.strict();

export const models = defineModels("show-hosts", [
	{
		kind: "list",
		name: "show-hosts",
		table: showHostsTable,
		parent: ["showId"],
		position: "position",
		item: host,
		// The show's pages list its hosts; each host's person page lists the
		// shows they host, so both the old and the new hosts change.
		tags: (parent, items) => [
			tag("shows", parent.showId),
			...tags(
				"people",
				items.map((item) => item.hostId),
			),
		],
	},
]);
