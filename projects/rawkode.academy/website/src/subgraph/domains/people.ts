import type SchemaBuilder from "@pothos/core";
import {
	type PersonItem,
	getPersonByGithub,
	getPersonById,
} from "../loaders/people";

export function registerPeople(
	builder: InstanceType<typeof SchemaBuilder<{}>>,
) {
	const PersonRef = builder.objectRef<PersonItem>("Person");
	builder.objectType(PersonRef, {
		fields: (t: any) => ({
			id: t.exposeString("id"),
			forename: t.exposeString("forename"),
			surname: t.exposeString("surname"),
			name: t.exposeString("name"),
			terms: t.field({
				type: ["String"],
				nullable: true,
				resolve: (p: PersonItem) => p.terms ?? null,
			}),
			githubHandle: t.field({
				type: "String",
				nullable: true,
				resolve: (p: PersonItem) => p.githubHandle ?? null,
			}),
			githubUrl: t.field({
				type: "String",
				nullable: true,
				resolve: (p: PersonItem) => p.githubUrl ?? null,
			}),
			avatarUrl: t.field({
				type: "String",
				nullable: true,
				resolve: (p: PersonItem) => p.avatarUrl ?? null,
			}),
		}),
	});

	builder.asEntity(PersonRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref: { id: string }) => getPersonById(ref.id),
	});

	builder.queryFields((t: any) => ({
		personByGithub: t.field({
			type: PersonRef,
			nullable: true,
			args: {
				username: t.arg.string({ required: true }),
			},
			resolve: async (_root: any, args: { username: string }) =>
				getPersonByGithub(args.username),
		}),
		me: t.field({
			type: PersonRef,
			nullable: true,
			resolve: async (_root: any, _args: any, context: any) => {
				const username = context?.user?.username;
				if (!username) return null;
				return getPersonByGithub(username);
			},
		}),
	}));

	return { PersonRef };
}
