import type SchemaBuilder from "@pothos/core";
import { type PersonItem, getPersonById } from "../loaders/people";

export function registerPeople(
	builder: InstanceType<typeof SchemaBuilder<{}>>,
) {
	const PersonRef = builder.objectRef<PersonItem>("Person");
	builder.objectType(PersonRef, {
		fields: (t: any) => ({
			id: t.exposeString("id"),
			forename: t.exposeString("forename"),
			surname: t.exposeString("surname"),
		}),
	});

	builder.asEntity(PersonRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref: { id: string }) => getPersonById(ref.id),
	});

	builder.queryFields((t: any) => ({
		me: t.field({
			type: PersonRef,
			nullable: true,
			resolve: async (_root: any, _args: any, context: any) => {
				const userId = context?.user?.id;
				if (!userId) return null;
				return getPersonById(userId);
			},
		}),
	}));

	return { PersonRef };
}
