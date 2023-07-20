import { CollectionConfig } from "payload/types";
import { slugField } from "../../fields/slug";
import { isAdmin } from "../../utilities/isAdmin";
import { Logo } from "../media";
import { socialMediaFields } from "../social";

export const Technologies: CollectionConfig = {
	slug: "technologies",
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
			name: "logo",
			type: "upload",
			relationTo: Logo.slug,
		},
		{
			name: "description",
			type: "richText",
			required: true,
		},
		{
			name: "hashtag",
			type: "text",
		},
		{
			name: "homepage",
			type: "text",
			required: true,
		},
		{
			name: "documentation",
			type: "text",
			required: true,
		},
		socialMediaFields,
		{
			name: "openSource",
			type: "checkbox",
			defaultValue: false,
		},
		{
			name: "openSourceDetails",
			type: "group",
			admin: {
				condition: (data) => {
					if (data.openSource) {
						return true;
					}
					return false;
				},
			},
			fields: [
				{
					name: "repository",
					type: "text",
					required: true,
				},
			],
		},
		slugField("name"),
	],
	timestamps: false,
};
