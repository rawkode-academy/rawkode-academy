import { Field } from "payload/types";

export const socialMediaFields: Field = {
	name: "socialMedia",
	type: "group",
	fields: [
		{
			name: "twitter",
			label: "Twitter Handle",
			type: "text",
		},
		{
			name: "linkedin",
			label: "LinkedIn Handle",
			type: "text",
		},
	],
};
