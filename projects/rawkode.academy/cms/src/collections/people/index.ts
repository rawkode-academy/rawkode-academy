import { CollectionConfig } from "payload/types";
import {
	isAdmin,
	isAdminOrSelf,
	isFieldAdmin,
	isFieldAdminOrSelf,
} from "../../utilities/isAdmin";
import { readOnlyField } from "../../utilities/readOnly";
import { socialMediaFields } from "../social";

export const People: CollectionConfig = {
	slug: "people",
	labels: { singular: "Person", plural: "People" },
	graphQL: { singularName: "Person", pluralName: "People" },
	auth: true,
	admin: {
		useAsTitle: "name",
	},
	access: {
		read: () => true,
		create: isAdmin,
		update: isAdminOrSelf,
		delete: isAdminOrSelf,
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
		},
		{
			name: "github",
			label: "GitHub",
			required: true,
			type: "text",
			unique: true,
			index: true,
			admin: {
				description:
					"If you've changed your GitHub username, please email support@rawkode.academy",
				readOnly: true,
				position: "sidebar",
			},
			access: {
				read: () => true,
				create: readOnlyField,
				update: readOnlyField,
			},
		},
		{
			name: "email",
			type: "email",
			required: true,
			unique: true,
			index: true,
			access: {
				read: isFieldAdminOrSelf,
			},
		},
		{
			name: "role",
			type: "select",
			admin: {
				position: "sidebar",
			},
			hasMany: false,
			defaultValue: "guest",
			required: true,
			access: {
				read: isFieldAdminOrSelf,
				create: isFieldAdmin,
				update: isFieldAdmin,
			},
			options: ["admin", "editor", "guest"],
		},
		socialMediaFields,
	],
};
