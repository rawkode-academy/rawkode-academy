import { CollectionConfig } from "payload/types";
import { slugField } from "../../fields/slug";
import { isAdmin } from "../../utilities/isAdmin";
import { People } from "../people";

export const Shows: CollectionConfig = {
	slug: "shows",
	admin: {
		useAsTitle: "name",
	},
	access: {
		read: () => true,
		create: isAdmin,
		update: isAdmin,
		delete: isAdmin,
	},
	fields: [
		{
			name: "name",
			type: "text",
		},
		{
			name: "hosts",
			type: "relationship",
			relationTo: People.slug,
			hasMany: true,
		},
		slugField("name"),
	],
	timestamps: false,
};
