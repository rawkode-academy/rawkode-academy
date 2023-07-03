import { CollectionConfig } from "payload/types";
import { People } from "../people";
import { slugField } from "../../fields/slug";

export const Shows: CollectionConfig = {
  slug: "shows",
  admin: {
    useAsTitle: "name",
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
      name: "hosts",
      type: "relationship",
      relationTo: People.slug,
      hasMany: true,
    },
    slugField(),
  ],
  timestamps: false,
};
