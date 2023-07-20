import { CollectionConfig } from 'payload/types';
import { isAdmin } from "../../utilities/isAdmin";
import { People } from "../people";
import { Shows } from "./shows";

export const Episodes: CollectionConfig = {
	slug: "episodes",
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
			name: "show",
			type: "relationship",
			relationTo: Shows.slug,
		},
		{
			name: "guests",
			type: "relationship",
			relationTo: People.slug,
			hasMany: true,
		},
	],
	timestamps: false,
};
