import { CollectionConfig } from "payload/types";

export const People: CollectionConfig = {
	slug: "people",
	auth: true,
	admin: {
		useAsTitle: "email",
	},
	access: {
		read: () => true,
	},
	fields: [
		{
			name: "name",
			type: "text",
		},
		{
			name: "githubHandle",
			label: "GitHub Handle",
			type: "text",
			access: {
				read: () => true,
			},
		},
		{
			name: "twitterHandle",
			label: "Twitter Handle",
			type: "text",
		},
		{
			name: "linkedinHandle",
			label: "LinkedIn Handle",
			type: "text",
		},
	],
};
