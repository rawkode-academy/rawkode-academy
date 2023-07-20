import { CollectionConfig } from 'payload/types';
import { isAdmin } from "../utilities/isAdmin";

const Categories: CollectionConfig = {
	slug: "categories",
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
	],
	timestamps: false,
};

export default Categories;
