import { CollectionConfig } from 'payload/types';
import { People } from "../people";

export const Shows: CollectionConfig = {
  slug: 'shows',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: "hosts",
      type: "relationship",
      relationTo: People.slug,
      hasMany: true,
    }
  ],
  timestamps: false,
}
