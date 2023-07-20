import type { CollectionConfig } from "payload/types";
import { isAdmin } from "../../utilities/isAdmin";

export const Logo: CollectionConfig = {
	slug: "logo",
	access: {
		read: () => true,
		create: isAdmin,
		update: isAdmin,
		delete: isAdmin,
	},
	upload: {
		disableLocalStorage: true,
	},
	fields: [],
};
