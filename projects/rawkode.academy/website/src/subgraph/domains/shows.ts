import type SchemaBuilder from "@pothos/core";
import { type ShowItem, getShowById, listShows } from "../loaders/shows";

export function registerShows(builder: InstanceType<typeof SchemaBuilder<{}>>) {
	const ShowRef = builder.objectRef<ShowItem>("Show");
	builder.objectType(ShowRef, {
		fields: (t: any) => ({
			id: t.exposeString("id"),
			name: t.exposeString("name"),
		}),
	});

	builder.asEntity(ShowRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref: { id: string }) => getShowById(ref.id),
	});

	builder.queryFields((t: any) => ({
		showById: t.field({
			type: ShowRef,
			nullable: true,
			args: {
				id: t.arg.string({ required: true }),
			},
			resolve: async (_root: any, args: { id: string }) => getShowById(args.id),
		}),
		allShows: t.field({
			type: [ShowRef],
			resolve: async () => listShows(),
		}),
	}));

	return { ShowRef };
}
